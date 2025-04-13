// Copyright (c) Bentley Systems, Incorporated. All rights reserved.
import {
  type RequestOptions,
  type RequestTimeoutOptions,
  type Response,
  request,
} from "@bentley/wsg-client";
import { ClashClientRASV2 } from "./ClashClientRASV2";

export class ClashClientRMS {
  private _timeout: RequestTimeoutOptions = {
    deadline: 60000,
    response: 60000,
  }; // 1 min
  private _rasClient: ClashClientRASV2;
  constructor() {
    this._rasClient = new ClashClientRASV2();
  }

  private _url = `https://${
    process.env.IMJS_URL_PREFIX ?? ""
  }connect-designvalidationrulemanagement.bentley.com`;

  private getUrl = async (): Promise<string> => {
    return this._url;
  };

  private async httpRequest(
    accessToken: string,
    url: string,
    method: string,
    projectId: string,
    operationTitle: string,
    additionalHeaders?: Object,
    body?: any
  ): Promise<Response | undefined> {
    const options: RequestOptions = {
      method: method,
      retries: 0,
      timeout: this._timeout,
      headers: {
        "Content-Type": "application/json",
        Authorization: accessToken,
        ...additionalHeaders,
      },
    };
    if (body) {
      /* eslint-disable-next-line @itwin/no-internal */
      options.body = body;
    }
    try {
      /* eslint-disable-next-line @itwin/no-internal */
      const response = await request(url, options);
      return response;
    } catch (reason) {
      console.log(reason, projectId, operationTitle);
      return undefined;
    }
  }

  public async runClashTests(
    iTwinId: string,
    accessToken: string,
    payload: any[],
    additionalHeaders?: Object
  ) {
    const url = (await this.getUrl()) + `/v3/contexts/${iTwinId}/tests/run`;
    const result = await this.httpRequest(
      accessToken,
      url,
      "POST",
      iTwinId,
      "runClashTest",
      additionalHeaders,
      payload
    );
    /* eslint-disable-next-line @itwin/no-internal */
    return result?.body;
  }

  public async getClashTests(
    accessToken: string,
    projectId: string,
    iModelId: string
  ) {
    const url =
      (await this.getUrl()) +
      `/v3/contexts/${projectId}/tests?repositoryId=${iModelId}&includeRulesCount=true`;
    let additionalHeaders = {
      configType: "2",
      "Include-User-Metadata": true,
      pageSize: "1000", // Get up to 1000 tests in a project. If this isn't set, we only get 10 at a time from RMS (so searching/sorting is not useable).
      continuationToken: "",
    };
    let rows: any[] = [];
    let hasMoreData = true;
    while (hasMoreData) {
      const clashApiResponse = await this.httpRequest(
        accessToken,
        url,
        "GET",
        projectId,
        "getClashTests",
        additionalHeaders
      );
      if (clashApiResponse === undefined) {
        return undefined;
      }
      /* eslint-disable-next-line @itwin/no-internal */
      if (clashApiResponse.body?.rows) {
        /* eslint-disable-next-line @itwin/no-internal */
        rows = [...rows, ...clashApiResponse.body.rows];
      }
      /* eslint-disable-next-line @itwin/no-internal */
      if (clashApiResponse.body?.hasMoreData) {
        /* eslint-disable-next-line @itwin/no-internal */
        hasMoreData = clashApiResponse.body.hasMoreData;
      } else {
        hasMoreData = false;
      }
      /* eslint-disable-next-line @itwin/no-internal */
      if (clashApiResponse.body?.continuationToken) {
        additionalHeaders = {
          ...additionalHeaders,
          /* eslint-disable-next-line @itwin/no-internal */
          continuationToken: clashApiResponse.body.continuationToken,
        };
      }
    }
    return {
      rows,
    };
  }

  public async getSpecificClashTest(
    accessToken: string,
    projectId: string,
    testId: string
  ) {
    const url =
      (await this.getUrl()) + `/v3/contexts/${projectId}/tests/${testId}`;
    const result = await this.httpRequest(
      accessToken,
      url,
      "GET",
      projectId,
      "getSpecificClashTest"
    );

    /* eslint-disable-next-line @itwin/no-internal */
    return result?.body;
  }

  public async getSpecificClashGroupsTest(
    accessToken: string,
    projectId: string,
    testId: string
  ) {
    const url =
      (await this.getUrl()) + `/v3/contexts/${projectId}/tests/${testId}`;
    const result = await this.httpRequest(
      accessToken,
      url,
      "GET",
      projectId,
      "getSpecificClashTest"
    );

    /* eslint-disable-next-line @itwin/no-internal */
    return result?.body;
  }

  // V3 Call
  public async createClashTests(
    accessToken: string,
    projectId: string,
    testsArray: any[]
  ) {
    const url = (await this.getUrl()) + `/v3/contexts/${projectId}/tests`;
    const result = await this.httpRequest(
      accessToken,
      url,
      "POST",
      projectId,
      "createClashTests",
      undefined,
      testsArray
    );

    /* eslint-disable-next-line @itwin/no-internal */
    return result?.body;
  }

  // V3 Call
  public async updateClashTest(
    accessToken: string,
    projectId: string,
    testId: string,
    test: any
  ): Promise<boolean> {
    const url =
      (await this.getUrl()) + `/v3/contexts/${projectId}/tests/${testId}`;
    const result = await this.httpRequest(
      accessToken,
      url,
      "PUT",
      projectId,
      "updateClashTest",
      undefined,
      test
    );

    return result !== undefined;
  }

  // V3 Call
  public async deleteClashTest(
    accessToken: string,
    projectId: string,
    testId: string
  ): Promise<boolean> {
    const url =
      (await this.getUrl()) + `/v3/contexts/${projectId}/tests/${testId}`;
    const result = this.httpRequest(
      accessToken,
      url,
      "DELETE",
      projectId,
      "deleteClashTest"
    );

    return result !== undefined;
  }

  // V3 Call
  public async deleteClashTests(
    accessToken: string,
    projectId: string,
    testGuids: string[],
    iModelId: string
  ): Promise<boolean> {
    const results = await this._rasClient.getClashResultsMetadataByProject(accessToken, projectId, iModelId, testGuids);
    let resultIds: string[] = [];
    results?.forEach(element => {
      resultIds.push(element.id);
    });

    if(resultIds.length > 0)
    {
      this._rasClient.deleteResults(accessToken, projectId, iModelId, resultIds);
    }

    const url = (await this.getUrl()) + `/v3/contexts/${projectId}/tests`;
    const result = await this.httpRequest(
      accessToken,
      url,
      "PATCH",
      projectId,
      "deleteClashTests",
      undefined,
      testGuids
    );

    return result !== undefined;
  }

  // V3 Call
  public async getSuppressionRuleTemplates(
    accessToken: string,
    projectId: string
  ) {
    const url =
      (await this.getUrl()) + `/v3/contexts/${projectId}/ruletemplates`;
    const additionalHeaders = { ruleTemplateType: "2", pageSize: 50 };
    const result = await this.httpRequest(
      accessToken,
      url,
      "GET",
      projectId,
      "getSuppressionRuleTemplates",
      additionalHeaders
    );

    /* eslint-disable-next-line @itwin/no-internal */
    return result?.body;
  }

  // V3 Call
  public async getSuppressionRules(
    accessToken: string,
    projectId: string,
    sortOrder?: any
  ) {
    const query = sortOrder ? `?orderBy=${sortOrder}` : "";
    const url =
      (await this.getUrl()) +
      `/v3/contexts/${projectId}/suppressionrules${query}`;
    let additionalHeaders:any = {
      "Include-User-Metadata": true,
      pageSize: "1000", // Get up to 1000 tests in a project. If this isn't set, we only get 10 at a time from RMS (so searching/sorting is not useable).
    };
    let hasMore = true;
    let rows: any = [];
    do {
      const result = await this.httpRequest(
        accessToken,
        url,
        "GET",
        projectId,
        "getSuppressionRules",
        additionalHeaders
      );
      
      hasMore = result?.body.hasMoreData
      if(hasMore)
      {
        additionalHeaders = {
          ...additionalHeaders,
          continuationtoken : result?.body.continuationToken
        }
      }

      rows = [...rows, ...result?.body.rows];
    } while (hasMore);

    /* eslint-disable-next-line @itwin/no-internal */
    return rows;
  }

  // V3 Call
  public async getSuppressionRuleById(
    accessToken: string,
    projectId: string,
    id: string
  ) {
    const url =
      (await this.getUrl()) +
      `/v3/contexts/${projectId}/suppressionrules/${id}`;
    const result = await this.httpRequest(
      accessToken,
      url,
      "GET",
      projectId,
      "getSuppressionRuleById"
    );

    /* eslint-disable-next-line @itwin/no-internal */
    return result?.body;
  }

  // V3 Call
  public async deleteSuppressionRule(
    accessToken: string,
    projectId: string,
    id: string
  ): Promise<Response | undefined> {
    const url =
      (await this.getUrl()) +
      `/v3/contexts/${projectId}/suppressionrules/${id}`;
    const result = await this.httpRequest(
      accessToken,
      url,
      "DELETE",
      projectId,
      "deleteSuppressionRule"
    );

    return result;
  }

  // V3 Call
  public async addSuppressionRule(
    accessToken: string,
    projectId: string,
    templateId: string,
    name: string,
    reason: string,
    parameters: string
  ): Promise<Response | undefined> {
    const url =
      (await this.getUrl()) + `/v3/contexts/${projectId}/suppressionrules`;
    // RMS api will accept parameters only if there is anything in it otherwise will throw an error
    const body =
      parameters !== "{}"
        ? {
            templateId,
            name,
            reason,
            parameters: JSON.parse(parameters),
          }
        : { templateId, name, reason };

    const result = await this.httpRequest(
      accessToken,
      url,
      "POST",
      projectId,
      "addSuppressionRule",
      undefined,
      body
    );

    return result;
  }

  // V3 Call
  public async updateSuppressionRule(
    accessToken: string,
    projectId: string,
    id: string,
    name: string,
    reason: string,
    parameters: string
  ): Promise<Response | undefined> {
    const url =
      (await this.getUrl()) +
      `/v3/contexts/${projectId}/suppressionrules/${id}`;
    // RMS api will accept parameters only if there is anything in it otherwise will throw an error
    const body =
      parameters !== "{}"
        ? {
            name,
            reason,
            parameters: JSON.parse(parameters),
          }
        : { name, reason };

    const result = await this.httpRequest(
      accessToken,
      url,
      "PATCH",
      projectId,
      "addSuppressionRule",
      undefined,
      body
    );

    return result;
  }
}
