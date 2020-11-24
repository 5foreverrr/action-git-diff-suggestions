import {promises as fs} from 'fs';

import * as github from '@actions/github';
import * as core from '@actions/core';
import {exec} from '@actions/exec';

import {parseGitPatch} from './parseGitPatch';

const {GITHUB_EVENT_PATH} = process.env;
const {owner, repo} = github.context.repo;
const token = core.getInput('github-token') || core.getInput('githubToken');
const octokit = token && github.getOctokit(token);
// @ts-ignore
const GITHUB_EVENT = require(GITHUB_EVENT_PATH);
const PATCH = '/tmp/__git_patch';

async function run(): Promise<void> {
  if (!octokit) {
    core.debug('No octokit client');
    return;
  }

  if (!github.context.payload.pull_request) {
    core.debug('Requires a pull request');
    return;
  }

  try {
    await exec(`git diff -U0 --color=never > ${PATCH}`);
  } catch (error) {
    core.setFailed(error.message);
  }

  const patchDiff = await fs.readFile(PATCH);
  const patches = parseGitPatch(patchDiff.toString());

  patches.forEach(patch => {
    octokit.pulls.createReviewComment({
      owner,
      repo,
      // @ts-ignore
      pull_number: github.context.payload.pull_request?.number,
      body: `
Something magical has suggested this change for you:

\`\`\`suggestion
${patch.added.lines.join('\n')}
\`\`\`
`,
      commit_id: GITHUB_EVENT.pull_request?.head.sha,
      path: patch.removed.file,
      side: 'RIGHT',
      start_side: 'RIGHT',
      start_line: patch.removed.start,
      line: patch.removed.end,
    });
  });
}

run();
