import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  getWorkspaceLayout,
  installPackagesTask,
  names,
  offsetFromRoot,
  Tree,
  updateJson,
  readJsonFile
} from '@nrwl/devkit';
import * as path from 'path';
import { dependencies } from '../../utils/dependencies';
import { AuthGeneratorSchema } from './schema';

interface NormalizedSchema extends AuthGeneratorSchema {
  projectName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
}

function normalizeOptions(
  tree: Tree,
  options: AuthGeneratorSchema
): NormalizedSchema {
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;
  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const projectRoot = `${getWorkspaceLayout(tree).libsDir}/${projectDirectory}`;
  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  return {
    ...options,
    projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
  };
}

function addFiles(tree: Tree, options: NormalizedSchema) {
  const templateOptions = {
    ...options,
    ...names(options.name),
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    template: ''
  };
  generateFiles(
    tree,
    path.join(__dirname, 'files'),
    options.projectRoot,
    templateOptions
  );
}

function updateDeps(tree: Tree){
  return addDependenciesToPackageJson(
    tree,
    {
      // ejs: dependencies.ejs,
      '@20i/cognito-nestjs': dependencies['@20i/cognito-nestjs']
    },
    {}
    )
}

function updateTsBaseConfig(tree: Tree, options: NormalizedSchema): void {
  // const project = readProjectConfiguration(tree, options.projectName);
  // `${project.root}/tsconfig.lib.json`

  const workspaceName = readJsonFile('package.json').name;
  return updateJson(tree, `tsconfig.base.json`, (json) => {
    const projectField = "@" + workspaceName + "/" + options.projectName

    json.compilerOptions.paths = {
      ...json.compilerOptions.paths,
      [projectField]: [`libs/${options.projectName}/src/`]
    }

    return json;
  });
}

export default async function (tree: Tree, options: AuthGeneratorSchema) {
  const normalizedOptions = normalizeOptions(tree, options);
  addProjectConfiguration(tree, normalizedOptions.projectName, {
    root: normalizedOptions.projectRoot,
    projectType: 'library',
    sourceRoot: `${normalizedOptions.projectRoot}/src`,
    targets: {
      build: {
        executor: '@gelfer/auth:build',
      },
    },
    tags: normalizedOptions.parsedTags,
  });
  updateDeps(tree)
  addFiles(tree, normalizedOptions);
  updateTsBaseConfig(tree, normalizedOptions)
  await formatFiles(tree);
  return () => {
    installPackagesTask(tree)
  }
}
