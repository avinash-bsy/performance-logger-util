// Copyright (c) Bentley Systems, Incorporated. All rights reserved.

import type { Response } from "@bentley/wsg-client";
import { type Id64String, BeUiEvent } from "@itwin/core-bentley";
import { ClashClientRASV2 } from "./ClashClientRASV2";
import { ClashClientRMS } from "./ClashClientRMS";
import { ClashValidationResultStatus } from "../../BaseClass";

export class ReloadClashTableEvent extends BeUiEvent<{}> {}

/** Handles obtaining clash results and visualizing them */
export class ClashDetectionManager {
  private _clientRAS: ClashClientRASV2;
  private _clientRMS: ClashClientRMS;
  private _accessToken: string;
  public calculateOverlap = false;

  constructor(public projectId: string, public iModelId: string, accessToken: string) {
    this._clientRMS = new ClashClientRMS();
    this._clientRAS = new ClashClientRASV2();
    this._accessToken = accessToken;
  }

  public async getClashResults(
    resultId: string
  ) {
    // To do maybe suppression rules can be passed in from the calling method? Also we need suppression rules in the format V1 was getting
    // hence the call to suppression rules and the parsing of them later on into a compatible format. Otherwise a lot of the code will have to be
    // rewritten which is not currently feasible
    const suppRules: any[] = await this.getSuppressionRules_V3();
    const results = await this._clientRAS.getClashResultsById(
      this._accessToken,
      resultId,
      this.projectId,
      suppRules
    );
    this.calculateOverlap = results?.calculateOverlap ?? false;
    // For RASV2 we need to get the suppression from the flag
    if (results?.clashes) {
      for (let i = 0; i < results.clashes.length; i++) {
        if (results.clashes[i].isMSupp === true) {
          // For compatibility set the suppressingManually where checks are made in parts of the code
          // To do can be removed later when suppressingManually checks in code are changed to use isMSupp
          results.clashes[i].suppressingManually = [
            Number(results.clashes[i].elementAId),
            Number(results.clashes[i].elementBId),
          ];
        }
      }
    }
    return results;
  }

  public async getClashHistory(
    clash: any
  ) {
    const results = await this._clientRAS.getClashSuppressionHistory(
      this._accessToken,
      this.projectId,
      clash.reportId!,
      clash.elementAId,
      clash.elementBId
    );
    return results;
  }

  public async suppress(
    clash: any,
    comment: string
  ) {
    return this._clientRAS.suppressClash(
      this._accessToken,
      clash,
      comment,
      this.projectId,
      this.iModelId
    );
  }

  public async cancelResults(
    contextId: string,
    resultsIds: string[]
  ): Promise<Response | undefined> {
    return this._clientRAS.cancelResults(
      this._accessToken,
      contextId,
      resultsIds
    );
  }

  // done
  public async getClashTestMetadata_V3() {
    const response = await this._clientRMS.getClashTests(
      this._accessToken,
      this.projectId,
      this.iModelId
    );
    if (response === undefined) {
      console.log("no response");
      return undefined;
    }

    let results = await this._clientRAS.getClashResultsMetadataByProject(
      this._accessToken,
      this.projectId,
      this.iModelId
    );
    if (results === undefined) {
      console.log("no results");
      return undefined;
    }

    results = results.sort((a, b) => {
      if (a.executed < b.executed) {
        return 1;
      } else if (a.executed > b.executed) {
        return -1;
      }
      return 0;
    });
    if (response.rows === undefined) {
      console.log("no response");
      return [];
    }
    const testsResultsMapping: any[] = [];
    for (const row of response.rows) {
      const currentTestResults = results.find(
        (res) => res.configurationId === row.id
      );
      const rawNewClashes = currentTestResults?.rawNewClashes ?? 0;
      const rawOpenClashes = currentTestResults?.rawOpenClashes ?? 0;
      const rawResolvedClashes = currentTestResults?.rawResolvedClashes ?? 0;
      const ruleSuppressedClashes =
        currentTestResults?.ruleSuppressedClashes ?? 0;
      const manuallySuppressedClashes =
        currentTestResults?.manuallySuppressedClashes ?? 0;
      const dualSuppressionClashes =
        currentTestResults?.dualSuppressionClashes ?? 0;
      const totalClashes = rawNewClashes + rawOpenClashes + rawResolvedClashes;
      const resolvedClashes =
        rawResolvedClashes +
        ruleSuppressedClashes +
        manuallySuppressedClashes +
        dualSuppressionClashes;
      const activeClashes = totalClashes - resolvedClashes;
      testsResultsMapping.push({
        ...row,
        user: row.userMetadata?.createdBy?.name,
        lastModifiedBy: row.userMetadata?.modifiedBy?.name,
        totalClashes,
        resolvedClashes,
        activeClashes,
        rawNewClashes,
        rawOpenClashes,
        rawResolvedClashes,
        ruleSuppressedClashes,
        manuallySuppressedClashes,
        dualSuppressionClashes,
        resultId: currentTestResults?.id,
        iModelId: currentTestResults?.iModelId,
        repositoryId: row.tag?.id,
        iModelVersionName:
          currentTestResults?.versionName &&
          this.isValidChangeSetId(currentTestResults.versionName)
            ? "no named version"
            : currentTestResults?.versionName,
        lastExecutedDate: currentTestResults?.executed,
        creationDate: new Date(row.creationDate),
        modificationDate: new Date(row.modificationDate),
        // an explicit check for undefined is needed for status and localizedStatus
        // to handle the case when the status is 0 (ClashValidationResultStatus.Started)
        status:
          currentTestResults?.status === undefined
            ? ClashValidationResultStatus.Created
            : currentTestResults.status,
        localizedStatus:
          currentTestResults?.status === undefined
            ? ClashValidationResultStatus.Created
            : 
              ClashValidationResultStatus[currentTestResults.status]
      });
    }

    return testsResultsMapping;
  }

  public async runTest_V3(
    payload: any[],
    additionalHeaders?: object
  ) {
    return await this._clientRMS.runClashTests(
      this.projectId,
      this._accessToken,
      payload,
      additionalHeaders
    );
  }

  // done
  public async getClashTestById(
    id: string
  ) {
    const response = await this._clientRMS.getSpecificClashTest(
      this._accessToken,
      this.projectId,
      id
    );

    if (!response) {
      console.log("no response");
      return undefined;
    }

    return response;
  }

  /**
   * Checks if a given string is 40 characters long with no spaces and consists only of lowercase English letters and numbers (0-9).
   *
   * @param {string} input - The string to be validated.
   * @returns {boolean} - Returns true if the string is valid, false otherwise.
   *
   * @example
   * const inputString = "bd5cfc4999bb906e61b2e1b36a6249599ad19456";
   * const isValid = isValidChangeSetId(inputString);
   * // isValid will be true
   */
  private isValidChangeSetId(input: string): boolean {
    const regex = /^[a-z0-9]{40}$/;
    return regex.test(input);
  }

  private getClashTestAPIFormat(test: any) {
    const {id, name, description} = test;
    return {
      id,
      name,
      description,
      configType: 2,
      setA: test.setA,
      setB: test.setB,
      touchingTolerance: Number(test.touchingTolerance),
      includeSubModels: test.includeSubModels,
      suppressionRules: test.suppressionRules,
      suppressTouching: test.suppressTouching,
      advancedSettings: test.advancedSettings,
      tag: {
        repositoryId: this.iModelId,
        repositoryType: "iModels",
      },
    };
  }


  public async createClashTests(testsArray: any[]) {
    const testsPost = testsArray.map((test) => {
      return this.getClashTestAPIFormat(test);
    });
    return await this.createClashTestAPIFormat(testsPost);
  }

  private async createClashTestAPIFormat(tests: any[]) {
    const response = await this._clientRMS.createClashTests(
      this._accessToken,
      this.projectId,
      tests
    );
    return response;
  }

  public async importClashTests(tests: any[]) {
    const testsPost = tests.map((test) => {
      return this.getClashTestAPIFormat(test);
    });
    return this.createClashTestAPIFormat(testsPost);
  }

  public async copyClashTest(
    test: any,
    clashTestName: string
  ) {
    // Get clash test
    const clashTest = await this.getClashTestById(test.id);
    if (clashTest === undefined) {
      // There was an error in the get clash test call. Return without doing anything.
      return;
    }

    if(clashTest.tag)
    {
      clashTest.tag = {
        repositoryId : clashTest.tag.id,
        repositoryType: clashTest.tag.type
      }
    }

    const clashTestToCopy = {
      ...clashTest,
      name: clashTestName,
    };

    return await this.createClashTestAPIFormat([clashTestToCopy]);
  }

  public async editClashTest(testId: string, test: any) {
    const testParams = this.getClashTestAPIFormat(test);
    const response = await this._clientRMS.updateClashTest(
      this._accessToken,
      this.projectId,
      testId,
      testParams
    );
    return response;
  }

  public async deleteClashTests(testIds: string[]) {
    const response = await this._clientRMS.deleteClashTests(
      this._accessToken,
      this.projectId,
      testIds
    );
    return response;
  }

  public async getSuppressionRuleTemplates_V3() {
    const response = await this._clientRMS.getSuppressionRuleTemplates(
      this._accessToken,
      this.projectId
    );

    if (!response?.rows) {
      console.log("no response");
      return [];
    }
    return response.rows;
  }

  public async getSuppressionRules_V3(
    sortOrder?: any
  ) {
    const response = await this._clientRMS.getSuppressionRules(
      this._accessToken,
      this.projectId,
      sortOrder
    );

    if (!response) {
      console.log("no response");
      return [];
    }
    return sortOrder ? response.reverse() : response; // for sorting RMS returns oldest one first and we want latest at the top
  }

  public async getSuppressionRuleById_V3(
    id: string
  ) {
    const response = await this._clientRMS.getSuppressionRuleById(
      this._accessToken,
      this.projectId,
      id
    );

    if (!response?.rows) {
      console.log("no response");
      return [];
    }
    return response.rows;
  }

  public async deleteSuppressionRule_V3(id: string): Promise<any> {
    const response = await this._clientRMS.deleteSuppressionRule(
      this._accessToken,
      this.projectId,
      id
    );
    /* eslint-disable-next-line @itwin/no-internal */
    if (response?.status !== 200) {
      console.log("no response");
      /* eslint-disable-next-line @itwin/no-internal */
      return response?.status;
    }
    /* eslint-disable-next-line @itwin/no-internal */
    return response?.status;
  }

  public async addSuppressionRule_V3(
    templateId: string,
    name: string,
    reason: string,
    parameters: string
  ): Promise<string> {
    const response = await this._clientRMS.addSuppressionRule(
      this._accessToken,
      this.projectId,
      templateId,
      name,
      reason,
      parameters
    );
    /* eslint-disable-next-line @itwin/no-internal */
    if (response?.status !== 201) {
      console.log("error creating suppression rule");
      return "";
    }
    /* eslint-disable-next-line @itwin/no-internal */
    return response.body.id;
  }

  public async updateSuppressionRule_V3(
    id: string,
    name: string,
    reason: string,
    parameters: string
  ): Promise<string> {
    const response = await this._clientRMS.updateSuppressionRule(
      this._accessToken,
      this.projectId,
      id,
      name,
      reason,
      parameters
    );
    /* eslint-disable-next-line @itwin/no-internal */
    if (response?.status !== 200) {
      console.log(
        "Error updating suppression rule for context: " + this.projectId
      );
      return "";
    }
    /* eslint-disable-next-line @itwin/no-internal */
    return response.body.id;
  }

  public async bulkCreateAndDeleteTests(test: any) {
    const testArray = Array(20).fill(test)
    console.time("BulkCreate - WSG")
    const res = await this.createClashTests( testArray);
    console.timeEnd("BulkCreate - WSG")
    if(res)
    {
      const testIds = res.status.map((t:any) => t.id);
      console.time("BulkDelete - WSG")
      await this._clientRMS.deleteClashTests(this._accessToken, this.projectId, testIds);
      console.timeEnd("BulkDelete - WSG")
    }
  }
}
