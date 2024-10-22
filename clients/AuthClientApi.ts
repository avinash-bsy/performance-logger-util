/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@itwin/core-bentley";
import { NodeCliAuthorizationClient } from "@itwin/node-cli-authorization";

import * as dotenv from 'dotenv';
dotenv.config();

export interface AuthArgs {
  accessToken: AccessToken;
}

export class AuthClientApi {

  private static _authClient?: NodeCliAuthorizationClient;

  private static createAuthClient() {
    const clientId = process.env.ClashRestClientId;
    const scope = process.env.ClashRestClientScopes;
    const redirectUri = process.env.ClashRestClientLoginRedirectUri;
    if (clientId === undefined || scope === undefined || redirectUri === undefined) {
      const msg = "[ERROR]: No environment for authorization found. Specify ClashRestClientId, ClashRestClientScopes and ClashRestClientLoginRedirectUri";
      throw new Error(msg);
    }
    return new NodeCliAuthorizationClient({ clientId, redirectUri, scope });
  }

  public static async getAccessToken(): Promise<AccessToken> {
    if (!this._authClient) {
      this._authClient = this.createAuthClient();
      await this._authClient.signIn();
    }
    return this._authClient.getAccessToken();
  }
}
