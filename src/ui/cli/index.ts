#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import boxen from "boxen";
import {
  initCommand,
  listCollectionsCommand,
  inspectCollectionCommand,
} from "./commands.js";

const program = new Command();

console.log(
  boxen(chalk.bold.blue("gh-as-db CLI"), {
    padding: 1,
    margin: 1,
    borderStyle: "double",
    borderColor: "blue",
  })
);

program
  .name("gh-as-db")
  .description("CLI to manage your GitHub-based database")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize connection and verify repository")
  .action(initCommand);

program
  .command("list")
  .alias("ls")
  .description("List all collections in the database")
  .action(listCollectionsCommand);

program
  .command("inspect <collection>")
  .description("Inspect the contents of a collection")
  .action(inspectCollectionCommand);

program.parse();
