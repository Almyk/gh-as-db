import enquirer from "enquirer";
import chalk from "chalk";
import { Octokit } from "@octokit/rest";
import { GitHubStorageProvider } from "../../infrastructure/github-storage.js";

export async function initCommand() {
  console.log(chalk.yellow("\n--- Database Initialization ---\n"));

  try {
    const questions = [
      {
        type: "input",
        name: "owner",
        message: "GitHub Repository Owner:",
      },
      {
        type: "input",
        name: "repo",
        message: "GitHub Repository Name:",
      },
      {
        type: "password",
        name: "accessToken",
        message: "GitHub Personal Access Token:",
      },
    ];

    const answers = await (enquirer as any).prompt(questions);

    const storage = new GitHubStorageProvider({
      owner: answers.owner,
      repo: answers.repo,
      accessToken: answers.accessToken,
    });

    process.stdout.write(chalk.blue("Verifying connection... "));
    const success = await storage.testConnection();

    if (success) {
      console.log(chalk.green("Success!"));
      console.log(
        chalk.dim(
          "\nYou can now use these credentials in your application configuration."
        )
      );
    } else {
      console.log(chalk.red("Failed."));
      console.log(
        chalk.red("Please check your token permissions and repository details.")
      );
    }
  } catch (error) {
    console.error(chalk.red("\nInitialization cancelled or failed."));
  }
}

export async function listCollectionsCommand() {
  console.log(chalk.yellow("\n--- Collections List ---\n"));

  const owner = process.env.GH_DB_OWNER;
  const repo = process.env.GH_DB_REPO;
  const auth = process.env.GH_DB_TOKEN;

  if (!owner || !repo || !auth) {
    console.log(
      chalk.red(
        "Error: Environment variables GH_DB_OWNER, GH_DB_REPO, and GH_DB_TOKEN must be set."
      )
    );
    return;
  }

  const octokit = new Octokit({ auth });

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: "",
    });

    if (Array.isArray(data)) {
      const collections = data
        .filter((item) => item.name.endsWith(".json"))
        .map((item) => item.name.replace(".json", ""));

      if (collections.length === 0) {
        console.log(chalk.dim("No collections found in the repository."));
      } else {
        collections.forEach((name) => {
          console.log(chalk.cyan(` • ${name}`));
        });
      }
    }
  } catch (error: any) {
    console.error(chalk.red(`Error fetching collections: ${error.message}`));
  }
}

export async function inspectCollectionCommand(name: string) {
  console.log(chalk.yellow(`\n--- Inspecting Collection: ${name} ---\n`));

  const owner = process.env.GH_DB_OWNER;
  const repo = process.env.GH_DB_REPO;
  const auth = process.env.GH_DB_TOKEN;

  if (!owner || !repo || !auth) {
    console.log(
      chalk.red(
        "Error: Environment variables GH_DB_OWNER, GH_DB_REPO, and GH_DB_TOKEN must be set."
      )
    );
    return;
  }

  const storage = new GitHubStorageProvider({
    owner,
    repo,
    accessToken: auth,
  });

  try {
    const path = `${name}.json`;
    if (!(await storage.exists(path))) {
      console.log(chalk.red(`Collection "${name}" does not exist.`));
      return;
    }

    const response = await storage.readJson<any[]>(path);
    console.log(JSON.stringify(response.data, null, 2));
    console.log(chalk.dim(`\nTotal records: ${response.data.length}`));
    console.log(chalk.dim(`Current SHA: ${response.sha}`));
  } catch (error: any) {
    console.error(chalk.red(`Error inspecting collection: ${error.message}`));
  }
}
