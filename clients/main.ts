import { SuppressionRuleAndMetadata } from "@bentley/clash-detection-rest-client";
import { ClashValidationResultStatus } from "../BaseClass";
import {ClashDetectionManager as RestClientManager} from "../clients/rest-client/ClashDetectionManager";
import {ClashDetectionManager as WsgManager} from "../clients/wsg-client/ClashDetectionManager";

let clashTest: any;
let clashTest2: any;
let resultId: string = "001fba17-bb25-40fb-b6c3-571f22e4bb0f";
let suppressionRule: SuppressionRuleAndMetadata;
const suppressionPayload = {
    "templateId": "c9767f64-cdda-4fec-be02-0f5ca05a430d",
    "name": "as-test",
    "reason": "testing",
    "parameters": {
        "likeExpression1": {
            "value": "boxes"
        },
        "likeExpression2": {
            "value": "Spheres"
        }
    }
};

const callWsg = true;
const callRC = true;
const callRCFirst = true;

async function executeWithOrder(opertaionTitle: string, rcFunction: any, wsgFunction: any): Promise<{rcResponse: any, wsgResponse: any}> {
    let rcResponse = undefined;
    let wsgResponse = undefined;

    if (callRC && callRCFirst) {
        console.time(`${opertaionTitle} - RC`);
        rcResponse = await rcFunction();
        console.timeEnd(`${opertaionTitle} - RC`);
        
        if (callWsg) {
            console.time(`${opertaionTitle} - WSG`);
            wsgResponse = await wsgFunction();
            console.timeEnd(`${opertaionTitle} - WSG`);
        }
    } else if (callWsg && !callRCFirst) {
        console.time(`${opertaionTitle} - WSG`);
        wsgResponse = await wsgFunction();
        console.timeEnd(`${opertaionTitle} - WSG`);
        
        if (callRC) {
            console.time(`${opertaionTitle} - RC`);
            rcResponse = await rcFunction();
            console.timeEnd(`${opertaionTitle} - RC`);
        }
    } else {
        if (callRC) {
            console.time(`${opertaionTitle} - RC`);
            rcResponse = await rcFunction();
            console.timeEnd(`${opertaionTitle} - RC`);
        }
        
        if (callWsg) {
            console.time(`${opertaionTitle} - WSG`);
            wsgResponse = await wsgFunction();
            console.timeEnd(`${opertaionTitle} - WSG`);
        }
    }

    return {
        rcResponse,
        wsgResponse
    }
}

export class LogTimeDifference {
    private _wsgManager: WsgManager;
    private _restClientManager: RestClientManager;

    private iModelId: string;
    private iTwinId: string;

    constructor(iTwinId: string, iModelId: string, accessToken: string) {
        this._wsgManager = new WsgManager(iTwinId, iModelId, accessToken);
        this._restClientManager = new RestClientManager(iTwinId, iModelId, accessToken);

        this.iModelId = iModelId;
        this.iTwinId = iTwinId;
    }

    private async getClashTests() {
        const {rcResponse, wsgResponse} = await executeWithOrder("getClashTests", async () => this._restClientManager.getClashTestMetadata_V3(), async () => this._wsgManager.getClashTestMetadata_V3());
        if(rcResponse)
        {
            clashTest = rcResponse[0];
            clashTest2 = rcResponse[1];
        }
    }

    private async getClashTestById() {
        const {rcResponse} = await executeWithOrder("getClashTestById", async () => this._restClientManager.getClashTestById(clashTest.id), async () => this._wsgManager.getClashTestById(clashTest.id));

        if(rcResponse)
        {
            clashTest = rcResponse
        }
    }

    private async copyClashTest() {
        const {rcResponse, wsgResponse} = await executeWithOrder("copyClashTest", async () => this._restClientManager.copyClashTest(clashTest, clashTest.name + " - Imported"), async () => this._wsgManager.copyClashTest(clashTest, clashTest.name + " - Imported"));

        if(rcResponse && wsgResponse)
        {
            await this._restClientManager.deleteClashTests([wsgResponse.status[0].id, rcResponse[0].id]);
        }
    }

    private async importClashTests() {
        const {rcResponse, wsgResponse} = await executeWithOrder("importClashTests", async () => this._restClientManager.importClashTests([clashTest]), async () => this._wsgManager.importClashTests([clashTest]));

        if(rcResponse && wsgResponse)
        {
            await this._restClientManager.deleteClashTests([wsgResponse.status[0].id, rcResponse[0].id]);
        }
    }

    private async createClashTests() {
        const {rcResponse, wsgResponse} = await executeWithOrder("createClashTests", async () => this._restClientManager.importClashTests([clashTest]), async () => this._wsgManager.importClashTests([clashTest]));

        if(wsgResponse && rcResponse)
        {
            await this._restClientManager.deleteClashTests([wsgResponse.status[0].id, rcResponse[0].id]);
        }
    }

    private async pollClashResult() {
        let isCompleted = true;
        do {
            console.log("Waiting for 5 seconds");
            await new Promise(resolve => setTimeout(resolve, 5000));

            const response = await this._restClientManager.getClashResults(resultId);
            if(response)
            {
                let status = ClashValidationResultStatus[response?.status];
                console.log(status);
                if(status === "Completed" || status === "Failed")
                {
                    isCompleted = false;
                }
            }
            
        } while (isCompleted);
    }

    private async editClashTest() {
        await executeWithOrder("editClashTest", async () => this._restClientManager.editClashTest(clashTest.id, clashTest), async () => this._wsgManager.editClashTest(clashTest.id, clashTest));

    }

    private async runClashTest() {
        const changesetId = "9d4a4c92c929c4eee7dd879fb9af519d9fa027e5";
        const params = [
            { iModelId : this.iModelId, changesetId, configurationId: clashTest.id }
        ];
        const params2 = [
            { iModelId : this.iModelId, changesetId, configurationId: clashTest2.id }
        ]
        const additionalHeaders = { "In-Place": "force" };

        try {
            await executeWithOrder(
                "runClashTest",
                async () => this._restClientManager.runTest_V3(params, "force"),
                async () => this._wsgManager.runTest_V3(params2, additionalHeaders)
            );
        } catch(error)
        {
            console.log(error);
        }
    }

    private async getClashResults() {
        await executeWithOrder("getClashResults", async () => this._restClientManager.getClashResults(resultId), async () => this._wsgManager.getClashResults(resultId));

    }

    private async deleteClashTest() {
        const testTwo = await this._restClientManager.createClashTests([clashTest]);
        const testOne = await this._restClientManager.createClashTests([clashTest]);

        if(testTwo && testOne)
        {
            await executeWithOrder("deleteClashTest", async () => this._restClientManager.deleteClashTests([testTwo[0].id]), async () => this._wsgManager.deleteClashTests([testOne[0].id]));
        }
    }

    private async getSuppressionRuleTemplates() {
        await executeWithOrder("getSuppressionRuleTemplates", async () => this._restClientManager.getSuppressionRuleTemplates_V3(), async () => this._wsgManager.getSuppressionRuleTemplates_V3());
    }

    private async getSuppressionRules() {
        const {rcResponse} = await executeWithOrder("getSuppressionRules", async () => this._restClientManager.getSuppressionRules_V3(), async () => this._wsgManager.getSuppressionRules_V3());

        if(rcResponse)
        {
            suppressionRule = rcResponse[0];
        }
    }

    private async getSuppressionRuleById() {
        await executeWithOrder("getSuppressionRuleById", async () => this._restClientManager.getSuppressionRuleById_V3(suppressionRule.id), async () => this._wsgManager.getSuppressionRuleById_V3(suppressionRule.id));
    }

    private async addSuppressionRule() {
        const {rcResponse, wsgResponse} = await executeWithOrder(
            "addSuppressionRule",
            async () => this._restClientManager.addSuppressionRule_V3(suppressionPayload.templateId, suppressionPayload.name, suppressionPayload.reason, JSON.stringify(suppressionPayload.parameters)),
            async () => this._wsgManager.addSuppressionRule_V3(suppressionPayload.templateId, suppressionPayload.name, suppressionPayload.reason, JSON.stringify(suppressionPayload.parameters))
        );

        if(rcResponse && wsgResponse)
        {
            await this._restClientManager.deleteSuppressionRule_V3(rcResponse);
            await this._restClientManager.deleteSuppressionRule_V3(wsgResponse);
        }
    }

    private async updateSuppressionRule() {
        const restRes = await this._wsgManager.addSuppressionRule_V3(suppressionPayload.templateId, suppressionPayload.name, suppressionPayload.reason, JSON.stringify(suppressionPayload.parameters));

        await executeWithOrder(
            "updateSuppressionRule",
            async () => this._restClientManager.updateSuppressionRule_V3(restRes, suppressionPayload.name + "-edited", suppressionPayload.reason, JSON.stringify(suppressionPayload.parameters)),
            async () => this._wsgManager.updateSuppressionRule_V3(restRes, suppressionPayload.name + "-edited", suppressionPayload.reason, JSON.stringify(suppressionPayload.parameters))
        );

        await this._restClientManager.deleteSuppressionRule_V3(restRes);
    }

    private async bulkCreateAndDeleteTests() {
        await executeWithOrder(
            "bulkCreateAndDeleteTests",
            async () => this._restClientManager.bulkCreateAndDeleteTests(clashTest),
            async () => this._wsgManager.bulkCreateAndDeleteTests(clashTest)
        );
    }

    private async deleteSuppressionRule() {
        const res1 = await this._wsgManager.addSuppressionRule_V3(suppressionPayload.templateId, suppressionPayload.name, suppressionPayload.reason, JSON.stringify(suppressionPayload.parameters));
        const res2 = await this._wsgManager.addSuppressionRule_V3(suppressionPayload.templateId, suppressionPayload.name, suppressionPayload.reason, JSON.stringify(suppressionPayload.parameters));

        await executeWithOrder(
            "updateSuppressionRule",
            async () => this._restClientManager.deleteSuppressionRule_V3(res1),
            async () => this._wsgManager.deleteSuppressionRule_V3(res2)
        );
    }

    public async init() {
        await this.getClashTests();
        await this.getClashTestById();
        await this.editClashTest();
        await this.copyClashTest();
        await this.importClashTests();
        await this.createClashTests();
        await this.deleteClashTest();
        await this.runClashTest();
        await this.getClashResults();
        await this.getSuppressionRuleTemplates();
        await this.getSuppressionRules();
        await this.getSuppressionRuleById();
        await this.addSuppressionRule();
        await this.updateSuppressionRule();
        await this.deleteSuppressionRule();
        await this.bulkCreateAndDeleteTests();
    }
}