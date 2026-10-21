declare module 'graphql-upload/processRequest.js' {
  import type { IncomingMessage, ServerResponse } from 'node:http';
  export interface ProcessRequestOptions {
    maxFieldSize?: number;
    maxFileSize?: number;
    maxFiles?: number;
  }
  export default function processRequest(
    request: IncomingMessage,
    response: ServerResponse,
    options?: ProcessRequestOptions,
  ): Promise<Record<string, unknown> | Record<string, unknown>[]>;
}
