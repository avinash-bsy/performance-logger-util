import { AuthClientApi } from "./clients/AuthClientApi";
import { LogTimeDifference } from "./clients/main";

import * as dotenv from 'dotenv';
dotenv.config();

const iTwinId = "57822e4f-5cf0-41b8-bda3-bb52f71cc095";
const iModelId = "6e59f05d-c8ea-438a-8230-77624661790f";

(async () => {
  const accessToken = await AuthClientApi.getAccessToken();
  const logTimeDifference = new LogTimeDifference(iTwinId, iModelId, accessToken);
  logTimeDifference.init();
})()