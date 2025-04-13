// Copyright (c) Bentley Systems, Incorporated. All rights reserved.
import type {
  ClashTestCreateParams,
  ClashTestMetadata,
  ClashTestUpdateParams,
  CreateSuppressionRuleParams,
  CreateTestStatus,
  RuleTemplate,
  SuppressionRule,
  SuppressionRuleAndMetadata,
  TestRunParams,
  TestRunStatus,
  UpdateSuppressionRuleParams,
} from "@bentley/clash-detection-rest-client";
import { ClashRestClient } from "@bentley/clash-detection-rest-client";
import type { AccessToken } from "@itwin/core-bentley";


export class ClashClientRMS {
  public _clashRestClient: ClashRestClient;
  private RMS_DEFAULT_PAGE_SIZE = 1000;
  constructor() {
    this._clashRestClient = new ClashRestClient(undefined, 6000);
  }

  private handleError(...args: any[]){
    console.log({...args});
  }

  public async runClashTests(
    iTwinId: string,
    getAccessToken: () => Promise<AccessToken>,
    payload: TestRunParams[],
    inPlace?: string
  ): Promise<TestRunStatus[] | undefined> {
    try {
      
      const runStatus = await this._clashRestClient.runTests({
        getAccessToken,
        iTwinId,
        params: payload,
        force: true
      });
      return runStatus;
    } catch (error) {
      throw error;
    }
  }

  private toClashTestStructure(
    testData: ClashTestMetadata,
    projectId: string
  ) {
    return {
      id: testData?.id,
      name: testData?.name,
      contextId: projectId,
      createdBy: testData?.createdBy?.id,
      creationDate: testData?.createdAt,
      description: testData?.description,
      lastModifiedBy: testData?.lastModifiedBy?.id,
      modificationDate: testData?.lastModifiedAt,
      rulesCount: testData?.rulesCount ?? 0,
      tag: testData?.tag,
      userMetadata: {
        createdBy: testData?.createdBy,
        modifiedBy: testData?.lastModifiedBy,
      },
    };
  }

  public async getClashTests(
    getAccessToken: () => Promise<AccessToken>,
    projectId: string,
    iModelId: string
  ) {
    try {
      const rows = [];
      
      for await (const clashTests of this._clashRestClient.queryTests({
        getAccessToken,
        iTwinId: projectId,
        includeRulesCount: true,
        pageSize: this.RMS_DEFAULT_PAGE_SIZE,
        iModelId
      })) {
        for (const row of clashTests) {
          const updatedTestData = this.toClashTestStructure(row, projectId);
          rows.push(updatedTestData);
        }
      }

      return rows;
    } catch (error) {
      console.log(error);
      this.handleError(
        error,
        projectId,
        "getClashTests"
      );

      return;
    }
  }

  public async getSpecificClashTest(
    getAccessToken: () => Promise<AccessToken>,
    projectId: string,
    testId: string
  ) {
    try {
      
      const clashTest = await this._clashRestClient.queryTestById({
        getAccessToken,
        iTwinId: projectId,
        testId,
      });
      return clashTest;
    } catch (error) {
      this.handleError(
        error,
        projectId,
        "getSpecificClashTest"
      );
      return;
    }
  }

  public async getSpecificClashGroupsTest(
    getAccessToken: () => Promise<AccessToken>,
    projectId: string,
    testId: string
  ){
    try {
      
      const clashTest = await this._clashRestClient.queryTestById({
        getAccessToken,
        iTwinId: projectId,
        testId,
      });
      return clashTest;
    } catch (error) {
      this.handleError(
        error,
        projectId,
        "getSpecificClashTest"
      );

      return;
    }
  }

  // V3 Call
  public async createClashTests(
    getAccessToken: () => Promise<AccessToken>,
    projectId: string,
    testsArray: ClashTestCreateParams[]
  ): Promise<CreateTestStatus[] | undefined> {
    try {
      
      const testStatuses = await this._clashRestClient.createTests({
        getAccessToken,
        iTwinId: projectId,
        params: testsArray,
      });
      return testStatuses;
    } catch (error) {
      this.handleError(
        error,
        projectId,
        "createClashTests"
      );
      return;
    }
  }

  // V3 Call
  public async updateClashTest(
    getAccessToken: () => Promise<AccessToken>,
    projectId: string,
    testId: string,
    test: ClashTestUpdateParams
  ): Promise<boolean> {
    try {
      
      await this._clashRestClient.updateTest({
        getAccessToken,
        iTwinId: projectId,
        testId,
        params: test,
      });
      return true;
    } catch (error) {
      this.handleError(
        error,
        projectId,
        "updateClashTest"
      );
      return false;
    }
  }

  // V3 Call
  public async deleteClashTest(
    getAccessToken: () => Promise<AccessToken>,
    projectId: string,
    testId: string
  ): Promise<boolean> {
    try {
      
      await this._clashRestClient.deleteTest({
        getAccessToken,
        iTwinId: projectId,
        testId,
      });
      return true;
    } catch (error) {
      this.handleError(
        error,
        projectId,
        "deleteClashTest"
      );
      return false;
    }
  }

  // V3 Call
  public async deleteClashTests(
    getAccessToken: () => Promise<AccessToken>,
    projectId: string,
    testGuids: string[]
  ): Promise<boolean> {
    try {
      const res = await this._clashRestClient.deleteTests({
        getAccessToken,
        iTwinId: projectId,
        testIds: testGuids,
      });
      return true;
    } catch (error) {
      this.handleError(
        error,
        projectId,
        "deleteClashTests"
      );
      return false;
    }
  }

  // V3 Call
  public async getSuppressionRuleTemplates(
    getAccessToken: () => Promise<AccessToken>,
    projectId: string
  ): Promise<RuleTemplate[] | undefined> {
    try {
      
      let rows: RuleTemplate[] = [];
      for await (const ruleTemplates of this._clashRestClient.queryRuleTemplates(
        { getAccessToken, iTwinId: projectId, pageSize: 50 }
      )) {
        rows = [...rows, ...ruleTemplates];
      }
      return rows;
    } catch (error) {
      this.handleError(
        error,
        projectId,
        "getSuppressionRuleTemplates"
      );
      return;
    }
  }

  // V3 Call
  public async getSuppressionRules(
    getAccessToken: () => Promise<AccessToken>,
    projectId: string,
    sortOrder?: any
  ): Promise<SuppressionRuleAndMetadata[] | undefined> {
    try {
      
      let suppressionRules: SuppressionRuleAndMetadata[] = [];
      for await (const rows of this._clashRestClient.querySuppressionRules({
        getAccessToken,
        iTwinId: projectId,
        orderBy: sortOrder,
        pageSize: this.RMS_DEFAULT_PAGE_SIZE,
      })) {
        suppressionRules = [...suppressionRules, ...rows];
      }
      return suppressionRules;
    } catch (error) {
      this.handleError(
        error,
        projectId,
        "getSuppressionRules"
      );
      return;
    }
  }

  // V3 Call
  public async getSuppressionRuleById(
    getAccessToken: () => Promise<AccessToken>,
    projectId: string,
    id: string
  ): Promise<SuppressionRuleAndMetadata | undefined> {
    try {
      
      const suppressionRule =
        await this._clashRestClient.querySuppressionRuleById({
          getAccessToken,
          iTwinId: projectId,
          ruleId: id,
        });
      return suppressionRule;
    } catch (error) {
      this.handleError(
        error,
        projectId,
        "getSuppressionRuleById"
      );
      return;
    }
  }

  // V3 Call
  public async deleteSuppressionRule(
    getAccessToken: () => Promise<AccessToken>,
    projectId: string,
    id: string
  ): Promise<boolean> {
    try {
      
      await this._clashRestClient.deleteSuppressionRuleById({
        getAccessToken,
        iTwinId: projectId,
        ruleId: id,
      });
      return true;
    } catch (error) {
      this.handleError(
        error,
        projectId,
        "deleteSuppressionRule"
      );
      return false;
    }
  }

  // V3 Call
  public async addSuppressionRule(
    getAccessToken: () => Promise<AccessToken>,
    projectId: string,
    templateId: string,
    name: string,
    reason: string,
    parameters: string
  ): Promise<SuppressionRule | undefined> {
    try {
      const params: CreateSuppressionRuleParams =
        parameters !== "{}"
          ? {
              templateId,
              name,
              reason,
              parameters: JSON.parse(parameters),
            }
          : { templateId, name, reason };
      
      const suppressionRule = await this._clashRestClient.createSuppressionRule(
        { getAccessToken, iTwinId: projectId, params }
      );
      return suppressionRule;
    } catch (error) {
      this.handleError(
        error,
        projectId,
        "addSuppressionRule"
      );
      return;
    }
  }

  // V3 Call
  public async updateSuppressionRule(
    getAccessToken: () => Promise<AccessToken>,
    projectId: string,
    id: string,
    name: string,
    reason: string,
    parameters: string
  ): Promise<boolean> {
    try {
      const params: UpdateSuppressionRuleParams =
        parameters !== "{}"
          ? {
              name,
              reason,
              parameters: JSON.parse(parameters),
            }
          : { name, reason };
      
      await this._clashRestClient.updateSuppressionRule({
        getAccessToken,
        iTwinId: projectId,
        ruleId: id,
        params,
      });
      return true;
    } catch (error) {
      this.handleError(
        error,
        projectId,
        "addSuppressionRule"
      );
      return false;
    }
  }
}
