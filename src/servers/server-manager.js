import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import http from 'http';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);

class ServerManager {
    constructor() {
        this.childProcesses = [];
        this.setupProcessHandlers();
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        process.stdout.write(logMessage);
    }

    setupProcessHandlers() {
        // Handle process termination signals
        const signals = ['SIGINT', 'SIGTERM', 'SIGUSR2'];
        signals.forEach(signal => {
            process.on(signal, async () => {
                this.log(`\nReceived ${signal}. Shutting down servers...`);
                await this.stopAllServers();
                process.exit(0);
            });
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', async (error) => {
            this.log(`\nUncaught Exception: ${error.message}\n${error.stack}`);
            await this.stopAllServers();
            process.exit(1);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', async (reason, promise) => {
            this.log(`\nUnhandled Rejection at: ${promise}, reason: ${reason}`);
            if (reason instanceof Error) {
                this.log(`Stack trace: ${reason.stack}`);
            }
            await this.stopAllServers();
            process.exit(1);
        });
    }

    async isPortInUse(port) {
        const checkHost = (host) => new Promise((resolve) => {
            const server = http.createServer();
            server.once('error', (error) => {
                resolve(error.code === 'EADDRINUSE');
            });
            server.once('listening', () => {
                server.close(() => resolve(false));
            });
            if (host) {
                server.listen(port, host);
            } else {
                server.listen(port);
            }
        });

        const [ipv4InUse, ipv6InUse] = await Promise.all([
            checkHost('0.0.0.0'),
            checkHost('::')
        ]);

        return ipv4InUse || ipv6InUse;
    }

    killProcessOnPort(port) {
        try {
            // First get the process info before killing
            const processInfo = execSync(`lsof -i:${port} -t -sTCP:LISTEN`).toString().trim();
            
            if (!processInfo) {
                this.log(`No process found listening on port ${port}`);
                return true;
            }
            
            // Get the command name and arguments
            const pid = processInfo.split('\n')[0].trim();
            const cmd = execSync(`ps -p ${pid} -o command=`).toString().trim();
            
            // Only kill Node.js processes that are part of our application
            if (cmd.includes('node') && (cmd.includes('semem') || cmd.includes('workbench'))) {
                this.log(`Killing process on port ${port} (${pid}): ${cmd}`);
                execSync(`kill -9 ${pid} 2>/dev/null || true`);
                return true;
            } else {
                this.log(`Not killing non-Node process on port ${port}: ${cmd}`);
                return false;
            }
        } catch (error) {
            if (error.message.includes('Command failed')) {
                this.log(`No process found on port ${port}`);
                return true;
            }
            this.log(`Error checking port ${port}: ${error.message}`);
            return false;
        }
    }

    async startServer(script, name, port, envVars = {}) {
        // Check if port is in use
        const portInUse = await this.isPortInUse(port);
        if (portInUse) {
            this.log(`⚠️  Port ${port} is in use. Attempting to free it...`);
            if (!this.killProcessOnPort(port)) {
                throw new Error(`Failed to free port ${port}`);
            }
        }

        const env = {
            ...process.env,
            ...envVars,
            PORT: port,
            NODE_ENV: 'production',
            FORCE_COLOR: '1'
        };

        this.log(`\n--- Starting ${name} (Port: ${port}) ---`);

        const child = spawn('node', [script], {
            stdio: 'pipe',
            cwd: PROJECT_ROOT,
            shell: true,
            env,
            detached: true
        });

        // Store child process info
        const processInfo = {
            name,
            port,
            process: child,
            startTime: new Date()
        };

        this.childProcesses.push(processInfo);

        // Handle process output
        child.stdout.on('data', (data) => {
            this.log(`[${name}] ${data.toString().trim()}`);
        });

        child.stderr.on('data', (data) => {
            this.log(`[${name}-ERROR] ${data.toString().trim()}`);
        });

        // Handle process exit
        child.on('exit', (code, signal) => {
            const index = this.childProcesses.findIndex(cp => cp.process.pid === child.pid);
            if (index !== -1) {
                this.childProcesses.splice(index, 1);
            }
            
            if (code !== 0) {
                this.log(`[${name}] Process exited with code ${code} and signal ${signal}`);
            }
        });

        // Wait for server to be ready
        await this.waitForPort(port);
        this.log(`[${name}] Server is running on port ${port}`);
        
        return child;
    }

    async waitForPort(port, timeout = 30000, interval = 500) {
        const startTime = Date.now();
        
        return new Promise((resolve, reject) => {
            const checkPort = async () => {
                const inUse = await this.isPortInUse(port);
                if (!inUse) {
                    if (Date.now() - startTime >= timeout) {
                        return reject(new Error(`Server did not start within ${timeout}ms`));
                    }
                    setTimeout(checkPort, interval);
                } else {
                    resolve();
                }
            };
            
            checkPort();
        });
    }

    async stopServer(port) {
        const serverIndex = this.childProcesses.findIndex(s => s.port === port);
        if (serverIndex === -1) {
            return Promise.resolve();
        }

        const server = this.childProcesses[serverIndex];
        this.log(`Stopping ${server.name} on port ${port}...`);

        return new Promise((resolve) => {
            server.process.on('close', () => {
                this.childProcesses.splice(serverIndex, 1);
                this.log(`${server.name} on port ${port} has been stopped`);
                resolve();
            });

            // Try to stop gracefully first
            server.process.kill('SIGTERM');
            
            // Force kill if not stopped after 5 seconds
            setTimeout(() => {
                if (server.process.exitCode === null) {
                    server.process.kill('SIGKILL');
                }
            }, 5000);
        });
    }

    async stopAllServers() {
        this.log('\nStopping all servers...');
        const stopPromises = this.childProcesses.map(server => 
            this.stopServer(server.port)
        );
        return Promise.all(stopPromises);
    }
}

export default ServerManager;
