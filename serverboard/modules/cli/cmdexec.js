import { spawn } from "node:child_process";

export function executeCommand(executable, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
    }, 30_000);

    child.on("error", error => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", code => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(
          new Error(
            `Command exited with code ${code}: ${stderr}`
          )
        );
      }
    });
  });
}

// Example
// const result = await executeCommand("render", ["workspaces"]);
// console.log(result.stdout);