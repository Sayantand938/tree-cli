// --- src/commands/tree.ts ---
import * as fs from 'fs';
import * as path from 'path';
import clipboardy from 'clipboardy';
import { getConfig } from './settings.js';

export async function treeCommand() {
  // Fetch configuration (e.g., excluded directories)
  const config = getConfig();
  const excludedDirs = config.get('excludeDirs') || [];
  const currentDirectory = process.cwd();

  // Create a regex pattern for excluded directories/files
  const exclusionPattern = new RegExp(
    excludedDirs
      .map((dir) => dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')
  );

  // Initialize the output string with the root directory label
  const rootLabel = `root: ${currentDirectory}`;
  let output = rootLabel + '\n';

  // Log the root label to the console
  console.log(rootLabel);

  /**
   * Recursively generates the directory tree.
   * @param dir - The current directory being processed.
   * @param prefix - The prefix string for indentation.
   */
  function generateTree(dir: string, prefix: string = '') {
    try {
      // Read the contents of the directory
      const files = fs.readdirSync(dir);
      // Filter out excluded directories/files
      const filteredFiles = files.filter(
        (file) => !exclusionPattern.test(file)
      );

      for (const [index, file] of filteredFiles.entries()) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        const isDirectory = stats.isDirectory();

        // Determine the connector based on whether it's the last item
        const connector = index === filteredFiles.length - 1 ? '└── ' : '├── ';
        const line = prefix + connector + file;
        output += line + '\n';
        console.log(line);

        // If it's a directory, recurse into it
        if (isDirectory) {
          const newPrefix =
            prefix + (index === filteredFiles.length - 1 ? '    ' : '│   ');
          generateTree(filePath, newPrefix);
        }
      }
    } catch (error) {
      console.error(`Error generating tree for ${dir}:`, error);
    }
  }

  try {
    // Start generating the tree from the current directory
    generateTree(currentDirectory);

    // Copy the output to the clipboard
    await clipboardy.write(output);
    // console.log('\nTree structure copied to clipboard.');
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        `Error generating tree or copying to clipboard: ${error.message}`
      );
    } else {
      console.error(`An unexpected error occurred: ${error}`);
    }
  }
}
