// Copyright (c) Bentley Systems, Incorporated. All rights reserved.

import {
  type RequestOptions,
  type RequestTimeoutOptions,
  type Response,
  request,
} from "@bentley/wsg-client";
import { type AccessToken, BentleyError } from "@itwin/core-bentley";
import { ClashValidationResultStatus } from "../../BaseClass";

export class ClashClientRASV2 {
  public static readonly CLASH_DETECTION_CONFIG_STRING = "Clash Detection";
  public static readonly UNKNOWN_CONFIG_STRING = "Unknown";
  private readonly CLASH_SUPPRESS_API_CALL_MAX_PAYLOAD = 50;
  private readonly RAS_DEFAULT_PAGE_SIZE = 100;
  private _timeout: RequestTimeoutOptions = {
    deadline: 120000,
    response: 120000,
  }; // 2 minutes

  constructor() {
  }

  private _url = `https://${
    process.env.IMJS_URL_PREFIX ?? ""
  }connect-resultsanalysisservice.bentley.com`;

  private getUrl = async (): Promise<string> => {
    return this._url;
  };

  private getModelCategoryLabel(list: any[], id: string): string {
    const item = list.find((x) => x.id === id);
    return item ? item.label : "";
  }

  private createRules(
    ruleIds: string[],
    suppressionRules: any[]
  ) {
    const ruleObjects: any[] = [];
    ruleIds.forEach((id: string) => {
      const suppRule = suppressionRules.find((rule) => rule.id === id);
      if (suppRule) {
        ruleObjects.push({
          id: id,
          name: suppRule.name,
          user: suppRule.createdBy,
          reason: suppRule.reason,
          definition: "",
          parameters: {},
          valid: true,
        });
      } else {
        ruleObjects.push({
          id: id,
          name: "",
          user: "",
          reason: "",
          definition: "",
          parameters: {},
          valid: true,
        });
      }
    });
    return ruleObjects;
  }

  private createClashObjectRAS(
    clash: any,
    originalIndex: number,
    categoryList: any[],
    modelList: any[],
    suppressionRules: any[]
  ) {
    return {
      id: originalIndex.toString(),
      elementAId: clash.elementAId,
      elementBId: clash.elementBId,
      elementALabel: clash.elementALabel,
      elementBLabel: clash.elementBLabel,
      elementACategoryId: clash.elementACategoryId,
      elementBCategoryId: clash.elementBCategoryId,
      elementAModelId: clash.elementAModelId,
      elementBModelId: clash.elementBModelId,
      elementACategoryLabel: this.getModelCategoryLabel(
        categoryList,
        clash.elementACategoryId
      ),
      elementBCategoryLabel: this.getModelCategoryLabel(
        categoryList,
        clash.elementBCategoryId
      ),
      elementAModelLabel: this.getModelCategoryLabel(
        modelList,
        clash.elementAModelId
      ),
      elementBModelLabel: this.getModelCategoryLabel(
        modelList,
        clash.elementBModelId
      ),
      type: clash.clashType,
      center: {
        x: clash.boundingSphere.center.x,
        y: clash.boundingSphere.center.y,
        z: clash.boundingSphere.center.z,
      },
      radius: clash.boundingSphere.radius,
      clearance: clash.clearance,
      additionalHilitableElementAIds: clash.additionalHilitableElementAIds
        ? clash.additionalHilitableElementAIds
        : [],
      additionalHilitableElementBIds: clash.additionalHilitableElementBIds
        ? clash.additionalHilitableElementBIds
        : [],
      suppressingRules: this.createRules(
        clash.suppressingRules,
        suppressionRules
      ),
      isMSupp: clash.isMSupp ? clash.isMSupp : false,
      suppressingManually: [], // Is set later on as it's needed for compatibility reasons
      status: clash.status,
      reportId: clash.clashReportId,
      uniqueId: clash.cuid,
    };
  }

  public async cancelResults(
    accessToken: string,
    contextId: string,
    resultsIds: string[]
  ): Promise<Response | undefined> {
    
    const url = await this.getUrl();
    const options: RequestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: accessToken,
        "itwin-id": contextId,
      },
      timeout: this._timeout,
      body: resultsIds,
    };

    try {
      /* eslint-disable-next-line @itwin/no-internal */
      const response = await request(url + "/v2/results/canceljobs", options);
      return response;
    } catch (exception) {
      console.log(exception);
      return undefined;
    }
  }

  private _parseStatus(status: number): string {
    const textStatus = String(ClashValidationResultStatus[status]);
    return textStatus;
  }

  private formatResultsMetaData(
    apiClashResults: any[]
  ) {
    const parsedResults = apiClashResults.map((apiResult) => {
      const formattedResult: any = {
        id: apiResult.id,
        contextId: apiResult.iTwinId,
        iModelId: apiResult.repositoryId,
        iModelName: apiResult.iModelName,
        versionName: apiResult.changesetName,
        numElements: apiResult.numElements,
        numIssues: apiResult.numIssues,
        numRules: apiResult.numRules,
        numValidations: apiResult.numValidations,
        status: apiResult.status,
        statusText: this._parseStatus(apiResult.status),
        testType:
          apiResult.configurationType ===
          2
            ? ClashClientRASV2.CLASH_DETECTION_CONFIG_STRING
            : ClashClientRASV2.UNKNOWN_CONFIG_STRING,
        executed:
          typeof apiResult.executed === "string"
            ? new Date(apiResult.executed)
            : apiResult.executed,
        userName: apiResult.userName,
        changesetId: apiResult.changesetId,
        configurationId: apiResult.configurationId,
        configurationName: apiResult.configurationName,
        duration: apiResult.duration,
        rawNewClashes: apiResult.vStatuses.new,
        rawOpenClashes: apiResult.vStatuses.open,
        rawResolvedClashes: apiResult.vStatuses.resolved,
        ruleSuppressedClashes: apiResult.vStatuses.rs,
        manuallySuppressedClashes: apiResult.vStatuses.ms,
        dualSuppressionClashes: apiResult.vStatuses.multiSup,
      };
      return formattedResult;
    });
    return parsedResults;
  }

  public async getClashResultsMetadataByProject(
    accessToken: string,
    contextId: string,
    iModelId: string
  ) {
    
    const url = await this.getUrl();

    const additionalHeaders = {
      "Content-Type": "application/json",
      Authorization: accessToken,
      "itwin-id": contextId,
      "repository-id": iModelId,
      Pagesize: this.RAS_DEFAULT_PAGE_SIZE,
      continuationToken: "",
    };
    let requestOptions = {
      method: "GET",
      headers: additionalHeaders,
      timeout: this._timeout,
    };
    let rows: any[] = [];
    let hasMoreData = true;
    while (hasMoreData) {
      let currentRows: any[] = [];
      try {
        /* eslint-disable-next-line @itwin/no-internal */
        const clashApiResponse = await request(
          url + "/v2/results",
          requestOptions
        );
        /* eslint-disable-next-line @itwin/no-internal */
        if (clashApiResponse?.body?.rows === undefined) {
          currentRows = [];
        }
        /* eslint-disable-next-line @itwin/no-internal */
        if (clashApiResponse?.body?.rows) {
          /* eslint-disable-next-line @itwin/no-internal */
          currentRows = this.formatResultsMetaData(clashApiResponse.body.rows);
        }
        /* eslint-disable-next-line @itwin/no-internal */
        if (clashApiResponse?.body?.hasMoreData) {
          /* eslint-disable-next-line @itwin/no-internal */
          hasMoreData = clashApiResponse.body.hasMoreData;
        } else {
          hasMoreData = false;
        }
        /* eslint-disable-next-line @itwin/no-internal */
        if (clashApiResponse?.body?.continuationToken) {
          requestOptions = {
            ...requestOptions,
            headers: {
              ...requestOptions.headers,
              /* eslint-disable-next-line @itwin/no-internal */
              continuationToken: clashApiResponse.body.continuationToken,
            },
          };
        }
      } catch (reason) {
        const message = BentleyError.getErrorMessage(reason);
        console.log(message);
        return undefined;
      }
      if (currentRows.length > 0) {
        rows = rows.concat(currentRows);
      }
    }
    return rows;
  }

  public async getClashResultsById(
    accessToken: string,
    resultId: string,
    projectId: string,
    suppressionRules: any[]
  ) {
    
    const url = await this.getUrl();
    const options = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: accessToken,
        "itwin-id": projectId,
        id: resultId,
      },
      timeout: this._timeout,
    };
    /* eslint-disable-next-line @itwin/no-internal */
    return request(url + `/V2/results/${resultId}`, options)
      .then(async (resp: Response) => {
        /* eslint-disable-next-line @itwin/no-internal */
        if (resp.body === undefined) {
          return undefined;
        }
        /* eslint-disable-next-line @itwin/no-internal */
        const clashData = resp.body.result;
        const parsedClashes: any[] = [];
        const clashes = clashData.clashes;
        // Get indices provided by the schema in the response of the body
        const calculateOverlap = clashData.calculateOverlap;

        // Generate the data object using the right indices
        clashes.forEach((clash: any, index: number) =>
          parsedClashes.push(
            this.createClashObjectRAS(
              clash,
              index,
              clashData.categoryList,
              clashData.modelList,
              suppressionRules
            )
          )
        );

        /* eslint-disable-next-line @itwin/no-internal */
        return { id: resp.body.resultMetadata.id, clashes: parsedClashes, calculateOverlap };
      })
      .catch((exception) => {
        console.log(exception);
        return undefined;
      });
  }

  public async getClashSuppressionHistory(
    accessToken: string,
    projectId: string,
    clashReportId: string,
    elementAId: string,
    elementBId: string
  ) {
    
    const url = await this.getUrl();
    const options = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: accessToken,
        "itwin-id": projectId,
      },
      timeout: this._timeout,
    };
    /* eslint-disable-next-line @itwin/no-internal */
    return request(
      url +
        `/V2/results/2/suppress?top=100&clashReportId=${clashReportId}&elementAId=${elementAId}&elementBId=${elementBId}&includeUserMetadata=true`,
      options
    )
      .then(
        async (
          resp: Response
        ) => {
          /* eslint-disable-next-line @itwin/no-internal */
          if (resp.body === undefined) {
            return undefined;
          }
          /* eslint-disable-next-line @itwin/no-internal */
          const clashData = resp.body.rows;
          return clashData;
        }
      )
      .catch((reason) => {
        console.log(reason);
        return undefined;
      });
  }

  // TODO: convert into a custom hook when Results Analysis Service
  //       can handle unsuppression of multiple clashes in one API call
  public async suppressClash(
    accessToken: string,
    clash: any,
    comment: string,
    projectId: string,
    iModelId: string
  ): Promise<{ response: Response } | undefined> {
    if (clash.reportId === undefined || clash.reportId === "") {
      return undefined;
    }
    let data;
    const isUnsuppressOperation: boolean = clash.isMSupp
      ? clash.isMSupp
      : false;
    const httpMethod = isUnsuppressOperation ? "DELETE" : "POST";
    if (isUnsuppressOperation) {
      data = {
        elementIds: [[clash.elementAId, clash.elementBId]],
        reason: comment,
      };
    } else {
      const elementIds = [clash.elementAId, clash.elementBId];
      data = { elementIds: [[...elementIds]], reason: comment };
    }
    const postBody = JSON.stringify(data);
    return this.httpRequestRAS(
      accessToken,
      `/V2/results/2/suppress`,
      projectId,
      iModelId,
      clash.reportId,
      postBody,
      httpMethod
    );
  }

  // TODO: convert into a custom hook when Results Analysis Service
  //       can handle unsuppression of multiple clashes in one API call
  public async suppressMultipleClashes(
    accessToken: string,
    clashesToSuppress: any[],
    comment: string,
    iTwinId: string,
    iModelId: string
  ) {
    const reportId = clashesToSuppress[0].reportId
      ? clashesToSuppress[0].reportId
      : "";
    const elementIdsOfClashes: string[][] = [];
    for (const clashToSuppress of clashesToSuppress) {
      const elementIdsOfClash: string[] = [
        clashToSuppress.elementAId,
        clashToSuppress.elementBId,
      ];
      elementIdsOfClashes.push(elementIdsOfClash);
    }

    // RAS only allows 50 clash results to be included in a suppress call. If there are more than 50, We must split the results
    // into groups of 50 and send seperate API calls
    const suppressChunkSize = this.CLASH_SUPPRESS_API_CALL_MAX_PAYLOAD;

    const apiCalls: Promise<{ response: Response } | undefined>[] = [];
    for (let i = 0; i < elementIdsOfClashes.length; i += suppressChunkSize) {
      const chunk = elementIdsOfClashes.slice(i, i + suppressChunkSize);
      apiCalls.push(
        this.suppressClashesAPICall(
          accessToken,
          chunk,
          comment,
          iTwinId,
          iModelId,
          reportId,
          clashesToSuppress[0].isMSupp ? "DELETE" : "POST"
        )
      );
    }
    return Promise.all(apiCalls);
  }

  private async suppressClashesAPICall(
    accessToken: string,
    elementIdsOfClashes: string[][],
    comment: string,
    iTwinId: string,
    iModelId: string,
    reportId: string,
    httpMethod: string
  ) {
    const data = { elementIds: elementIdsOfClashes, reason: comment };
    const postBody = JSON.stringify(data);
    return this.httpRequestRAS(
      accessToken,
      `/V2/results/2/suppress`,
      iTwinId,
      iModelId,
      reportId,
      postBody,
      httpMethod
    );
  }

  private async httpRequestRAS(
    accessToken: string,
    operation: string,
    projectId: string,
    iModelid: string,
    reportId: string,
    data: string,
    httpMethod: string
  ): Promise<{ response: Response } | undefined> {
    
    const url = await this.getUrl();
    const options = {
      method: httpMethod,
      headers: {
        "Content-Type": "application/json",
        Authorization: accessToken,
        "itwin-id": projectId,
        "repository-id": iModelid,
        "clash-report-id": reportId,
      },
      timeout: this._timeout,
      body: data,
    };
    /* eslint-disable-next-line @itwin/no-internal */
    return request(url + operation, options)
      .then((resp: Response): any | undefined => {
        return { response: resp };
      })
      .catch((error) => {
        console.log(error);
        return undefined;
      });
  }
}
