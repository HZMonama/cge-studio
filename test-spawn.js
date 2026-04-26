const { spawn } = require('child_process');

const args = [
  '--print',
  '--output-format', 'stream-json',
  '--verbose',
  '--dangerously-skip-permissions',
  '--add-dir', '/home/z/Documents/CGE Workspaces/acme-p0xwf1',
  '--append-system-prompt', 'Active CGE workspace: /home/z/Documents/CGE Workspaces/acme-p0xwf1. Write all output files to paths inside this workspace directory. Use /home/z/Documents/CGE Workspaces/acme-p0xwf1/grc-reports/ for generated reports.',
  'Please generate a DORA Article 6 evidence checklist for credit institutions'
];

console.log('Spawning claude with args:', args);

const child = spawn('claude', args, {
  cwd: '/home/z/Code/Maynframe Inc./cge-studio/cli/claude-grc-engineering',
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (chunk) => {
  stdout += chunk.toString();
  console.log('STDOUT chunk:', chunk.toString().substring(0, 100));
});

child.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
  console.log('STDERR chunk:', chunk.toString().substring(0, 100));
});

child.on('close', (code) => {
  console.log('\n=== Exit code:', code, '===');
  console.log('STDOUT length:', stdout.length);
  console.log('STDERR length:', stderr.length);
  console.log('First 200 chars of stdout:', stdout.substring(0, 200));
});
