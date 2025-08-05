import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import * as assert from "assert";
import express from "express";
import * as http from "http";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { BidiHttpTransport } from "../bidi-http-transport";

// Mocks and helper functions for testing
class MockOutputChannel implements vscode.OutputChannel {
  name: string;
  logs: string[] = [];

  constructor(name: string) {
    this.name = name;
  }

  append(value: string): void {
    this.logs.push(value);
  }

  appendLine(value: string): void {
    this.logs.push(value + "\n");
  }

  clear(): void {
    this.logs = [];
  }

  show(preserveFocus?: boolean): void;
  show(column?: vscode.ViewColumn, preserveFocus?: boolean): void;
  show(_columnOrPreserveFocus?: vscode.ViewColumn | boolean, _preserveFocus?: boolean): void {}

  hide(): void {}

  replace(_value: string): void {}

  dispose(): void {}
}

suite("BidiHttpTransport Test Suite", function () {
  this.timeout(10000); // 10-second timeout

  let transport: BidiHttpTransport;
  let outputChannel: MockOutputChannel;
  let server: http.Server;
  let mockOnMessage: sinon.SinonStub;
  let testPort: number;

  // Set up a test server
  async function setupTestServer(port: number): Promise<http.Server> {
    const app = express();
    app.use(express.json());

    // /ping endpoint
    app.get("/ping", (_req: express.Request, res: express.Response) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // /request-handover endpoint
    app.post("/request-handover", (_req: express.Request, res: express.Response) => {
      res.json({ success: true });
    });

    // Start the mock server
    return new Promise((resolve) => {
      const server = app.listen(port, () => {
        resolve(server);
      });
    });
  }

  setup(async function () {
    // Select a port for testing
    testPort = 6020;

    // Set up mocks
    outputChannel = new MockOutputChannel("Test Output");
    mockOnMessage = sinon.stub();

    // Create an instance of the class under test
    transport = new BidiHttpTransport(testPort, outputChannel as unknown as vscode.OutputChannel);
    transport.onmessage = mockOnMessage;

    // Set up a test server
    server = await setupTestServer(testPort + 1);
  });

  teardown(async function () {
    // Clean up the test
    await transport.close();
    if (server) {
      server.close();
    }
  });

  test("should start the server on the specified port", async function () {
    await transport.start();

    assert.ok(outputChannel.logs.some((log) => log.includes(`MCP Bridge running at :${testPort}`)));
  });

  test("should fail if the port is already in use", async function () {
    // Start another server on the first port
    const blockingServer = await setupTestServer(testPort);

    try {
      let errorThrown = false;
      try {
        await transport.start();
      } catch (err) {
        errorThrown = true;
        assert.ok((err as Error).message.includes(`Failed to bind to port ${testPort}`));
      }
      assert.ok(errorThrown, "Expected an error to be thrown when port is in use");
    } finally {
      blockingServer.close();
    }
  });

  test("requestHandover should set isServerRunning to true upon successful response", async function () {
    await transport.start();

    // Before the request, it's true (set by start())
    assert.strictEqual(transport.isServerRunning, true);

    // Mock the fetch method of requestHandover
    const originalFetch = global.fetch;

    // @ts-ignore
    global.fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
        text: async () => JSON.stringify({ success: true }),
      } as Response;
    };

    // Mock start() to avoid actually restarting the server
    const originalStart = transport.start;
    transport.start = async () => {
      // Simulate that the server has started
      assert.ok(outputChannel.logs.some((log) => log.includes("Server is now running")));
    };

    try {
      // Execute the request
      const result = await transport.requestHandover();

      // Check the result
      assert.strictEqual(result, true);
      assert.strictEqual(transport.isServerRunning, true);
    } finally {
      // Restore the mock
      global.fetch = originalFetch;
      transport.start = originalStart;
    }
  });

  test("send should throw an error if no clients are connected", async function () {
    await transport.start();

    // Call send without a client
    const message: JSONRPCMessage = {
      jsonrpc: "2.0",
      method: "test",
      id: 1,
    };

    let threwError = false;
    try {
      await transport.send(message);
    } catch (err) {
      threwError = true;
      assert.ok((err as Error).message.includes("No clients connected"));
    }

    assert.ok(threwError, "Expected an error to be thrown");
  });
});
