"use client";

import { io, type Socket } from "socket.io-client";

import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./game";

export const socket: Socket<
  ServerToClientEvents,
  ClientToServerEvents
> = io({
  autoConnect: false,
});