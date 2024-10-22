// Copyright (c) Bentley Systems, Incorporated. All rights reserved.

import type {
  Clash,
  ClashResultsMetadata,
  ManualSuppression,
  ReferenceIdList,
  SuppressionRuleAndMetadata,
} from "@bentley/clash-detection-rest-client";
import { ClashRestClient } from "@bentley/clash-detection-rest-client";
import { ClashValidationResultStatus } from "../../BaseClass";
import { AccessToken } from "@itwin/core-bentley";
/*
This class contains methods used to obtain clash results from Result Analysis Service (RAS)
See: https://qa-connect-resultsanalysisservice.bentley.com/api-docs/?urls.primaryName=v2

RAS is the service that facilitates querying for clash (and validation) results.
*/
export class ClashClientRASV2 {
  public static readonly CLASH_DETECTION_CONFIG_STRING = "Clash Detection";
  public static readonly UNKNOWN_CONFIG_STRING = "Unknown";
  private readonly _clashRestClient;
  private readonly CLASH_SUPPRESS_API_CALL_MAX_PAYLOAD = 50;
  private readonly RAS_API_TIMEOUT = 120000;
  private readonly RAS_DEFAULT_PAGE_SIZE = 100;

  constructor() {
    this._clashRestClient = new ClashRestClient(undefined, this.RAS_API_TIMEOUT);
  }

  private getModelCategoryLabel(list: ReferenceIdList[], id: string): string {
    const item = list.find((x) => x.id === id);
    return item ? item.label : "";
  }

  private createRules(
    ruleIds: string[],
    suppressionRules: SuppressionRuleAndMetadata[]
  ) {
    const ruleObjects: any[] = [];
    ruleIds.forEach((id: string) => {
      const suppRule = suppressionRules.find((rule) => rule.id === id);
      if (suppRule) {
        ruleObjects.push({
          id: id,
          name: suppRule.name,
          user: suppRule.createdBy?.name ?? "",
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
    clash: Clash,
    originalIndex: number,
    categoryList: ReferenceIdList[],
    modelList: ReferenceIdList[],
    suppressionRules: SuppressionRuleAndMetadata[]
  ) {
    return {
      id: originalIndex.toString(),
      elementAId: clash.elementIdA,
      elementBId: clash.elementIdB,
      elementALabel: clash.elementLabelA,
      elementBLabel: clash.elementLabelB,
      elementACategoryId: clash.categoryIdA,
      elementBCategoryId: clash.categoryIdB,
      elementAModelId: clash.modelIdA,
      elementBModelId: clash.modelIdB,
      elementACategoryLabel: this.getModelCategoryLabel(
        categoryList,
        clash.categoryIdA
      ),
      elementBCategoryLabel: this.getModelCategoryLabel(
        categoryList,
        clash.categoryIdB
      ),
      elementAModelLabel: this.getModelCategoryLabel(modelList, clash.modelIdA),
      elementBModelLabel: this.getModelCategoryLabel(modelList, clash.modelIdB),
      type: clash.type,
      center: {
        x: clash.boundingSphere.center.x,
        y: clash.boundingSphere.center.y,
        z: clash.boundingSphere.center.z,
      },
      radius: clash.boundingSphere.radius,
      clearance: clash.clearance,
      additionalHilitableElementAIds: clash.additionalHilitableElementIdsA
        ? clash.additionalHilitableElementIdsA
        : [],
      additionalHilitableElementBIds: clash.additionalHilitableElementIdsB
        ? clash.additionalHilitableElementIdsB
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
    getAccessToken: () => Promise<AccessToken>,
    contextId: string,
    resultsIds: string[]
  ): Promise<{ data: { message: string }; status: number } | undefined> {
    try {
      const response = await this._clashRestClient.cancelJobs({
        getAccessToken,
        iTwinId: contextId,
        resultIds: resultsIds,
      });
      return response;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }

  private _parseStatus(status: number): string {
    const textStatus = String(ClashValidationResultStatus[status]);
    return textStatus;
  }

  private formatResultsMetaData(
    apiClashResults: ClashResultsMetadata[]
  ) {
    const parsedResults = apiClashResults.map(
      (apiResult: ClashResultsMetadata) => {
        const formattedResult = {
          id: apiResult.id,
          contextId: apiResult.iTwinId,
          iModelId: apiResult.iModelId,
          iModelName: apiResult.repositoryName,
          versionName: apiResult.changesetName,
          numElements: String(apiResult.numElements),
          numIssues: apiResult.numIssues,
          numRules: String(apiResult.numRules),
          numValidations: String(apiResult.numValidations),
          status: apiResult.status,
          statusText: this._parseStatus(apiResult.status),
          testType:
            apiResult.configurationType === 2
              ? ClashClientRASV2.CLASH_DETECTION_CONFIG_STRING
              : ClashClientRASV2.UNKNOWN_CONFIG_STRING,
          executed:
            typeof apiResult.executed === "string"
              ? new Date(apiResult.executed)
              : apiResult.executed,
          userName: apiResult.createdBy.name,
          changesetId: apiResult.changesetId,
          configurationId: apiResult.configurationId,
          configurationName: apiResult.configurationName,
          duration: apiResult.duration,
          rawNewClashes: apiResult.vStatuses?.new
            ? apiResult.vStatuses?.new
            : 0,
          rawOpenClashes: apiResult.vStatuses?.open
            ? apiResult.vStatuses?.open
            : 0,
          rawResolvedClashes: apiResult.vStatuses?.resolved
            ? apiResult.vStatuses?.resolved
            : 0,
          ruleSuppressedClashes: apiResult.vStatuses?.rs
            ? apiResult.vStatuses?.rs
            : 0,
          manuallySuppressedClashes: apiResult.vStatuses?.ms
            ? apiResult.vStatuses?.ms
            : 0,
          dualSuppressionClashes: apiResult.vStatuses?.multiSup
            ? apiResult.vStatuses?.multiSup
            : 0,
        };
        return formattedResult;
      }
    );
    return parsedResults;
  }

  public async getClashResultsMetadataByProject(
    getAccessToken: () => Promise<AccessToken>,
    contextId: string,
    iModelId: string
  ) {
    try {
      
      let rows: any[] = [];
      for await (const results of this._clashRestClient.queryResults({
        getAccessToken,
        iTwinId: contextId,
        iModelId,
        pageSize: this.RAS_DEFAULT_PAGE_SIZE,
      })) {
        rows = [...rows, ...this.formatResultsMetaData(results)];
      }

      return rows;
    } catch (error) {
      console.log(error)
      return undefined;
    }
  }

  public async getClashResultsById(
    getAccessToken: () => Promise<AccessToken>,
    resultId: string,
    projectId: string,
    suppressionRules: SuppressionRuleAndMetadata[]
  ) {
    try {
      const clashResult = await this._clashRestClient.queryResultById({
        getAccessToken,
        iTwinId: projectId,
        resultId,
      });
      if (!clashResult) {
        return undefined;
      }
      const parsedClashes: any[] = [];
      const clashes: Clash[] = clashResult.clashes;
      // Get indices provided by the schema in the response of the body
      const calculateOverlap = clashResult.calculateOverlap;

      // Generate the data object using the right indices
      clashes.forEach((clash: Clash, index: number) =>
        parsedClashes.push(
          this.createClashObjectRAS(
            clash,
            index,
            clashResult.categoryList,
            clashResult.modelList,
            suppressionRules
          )
        )
      );

      return { id: clashResult.id, clashes: parsedClashes, calculateOverlap, status : clashResult.status };
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }

  public async getClashSuppressionHistory(
    getAccessToken: () => Promise<AccessToken>,
    projectId: string,
    clashReportId: string,
    elementIdA: string,
    elementIdB: string
  ): Promise<ManualSuppression[] | undefined> {
    try {
      
      const manaulSuppressions =
        await this._clashRestClient.queryManualSuppressions({
          getAccessToken,
          iTwinId: projectId,
          elementIdA,
          elementIdB,
          resultId: clashReportId,
          top: 100,
          includeUserMetadata: true,
        });
      if (!manaulSuppressions) {
        return undefined;
      }
      return manaulSuppressions;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }

  // TODO: convert into a custom hook when Results Analysis Service
  //       can handle unsuppression of multiple clashes in one API call
  public async suppressClash(
    getAccessToken: () => Promise<AccessToken>,
    clash: any,
    comment: string,
    projectId: string,
    iModelId: string
  ): Promise<string | undefined> {
    try {
      if (clash.reportId === undefined || clash.reportId === "") {
        return undefined;
      }
      let data;
      const isUnsuppressOperation: boolean = clash.isMSupp
        ? clash.isMSupp
        : false;
      if (isUnsuppressOperation) {
        data = {
          elementIds: [[clash.elementAId, clash.elementBId]],
          reason: comment,
        };
      } else {
        const elementIds = [clash.elementAId, clash.elementBId];
        data = { elementIds: [[...elementIds]], reason: comment };
      }

      
      const response = await this._clashRestClient.applyManualSuppression({
        getAccessToken,
        iTwinId: projectId,
        iModelId,
        resultId: clash.reportId,
        params: data,
      });
      return response;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }

  // TODO: convert into a custom hook when Results Analysis Service
  //       can handle unsuppression of multiple clashes in one API call
  public async suppressMultipleClashes(
    getAccessToken: () => Promise<AccessToken>,
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

    const apiCalls: Promise<string | undefined>[] = [];
    for (let i = 0; i < elementIdsOfClashes.length; i += suppressChunkSize) {
      const chunk = elementIdsOfClashes.slice(i, i + suppressChunkSize);
      apiCalls.push(
        this.suppressClashesAPICall(
          getAccessToken,
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
    getAccessToken: () => Promise<AccessToken>,
    elementIdsOfClashes: string[][],
    comment: string,
    iTwinId: string,
    iModelId: string,
    reportId: string,
    httpMethod: string
  ): Promise<string | undefined> {
    try {
      const data = { elementIds: elementIdsOfClashes, reason: comment };
      
      let response = undefined;
      if (httpMethod === "DELETE") {
        response = await this._clashRestClient.deleteManualSuppressions({
          getAccessToken,
          iTwinId,
          iModelId,
          resultId: reportId,
          params: data,
        });
      } else {
        response = await this._clashRestClient.applyManualSuppression({
          getAccessToken,
          iTwinId,
          iModelId,
          resultId: reportId,
          params: data,
        });
      }

      return response;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }
}
