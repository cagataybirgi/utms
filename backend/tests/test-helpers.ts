import request from "supertest";
import { createApp } from "../src/app";
import { createContainer, AppContainer } from "../src/shared/container";

export interface TestKit {
  app: ReturnType<typeof createApp>["app"];
  container: AppContainer;
  asUser: (userId: string) => UserAgent;
}

export interface UserAgent {
  get(path: string): request.Test;
  post(path: string): request.Test;
  patch(path: string): request.Test;
  delete(path: string): request.Test;
}

export function buildTestKit(): TestKit {
  const container = createContainer();
  const { app } = createApp({ container });
  const asUser = (userId: string): UserAgent => ({
    get: (p: string) => request(app).get(p).set("x-mock-user", userId),
    post: (p: string) => request(app).post(p).set("x-mock-user", userId),
    patch: (p: string) => request(app).patch(p).set("x-mock-user", userId),
    delete: (p: string) => request(app).delete(p).set("x-mock-user", userId),
  });
  return { app, container, asUser };
}

export const TEST_USERS = {
  oidb: "user-oidb-1",
  ydyo: "user-ydyo-1",
  ygkMember: "user-ygk-cmpe-1",
  ygkChair: "user-ygk-chair-cmpe",
  deans: "user-deans-eng",
  student: "student-ahmet-yilmaz",
};
