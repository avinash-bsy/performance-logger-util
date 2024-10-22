export enum ClashValidationResultStatus {
    Queued = -1,
    Started = 0,
    Completed = 1,
    Failed = 2,
    DownloadingiModel = 3,
    StoringResults = 4,
    ValidationInProgress = 5,
    ValidationLimited = 6,
    Cancelled = 7,
    FailedSuppressionRules = 8,
    CompletedWithElementLoadErrors = 9,
    Created = 10,
    Canceling = 11,
  }

export class BaseClass {
    protected readonly RMS_URL = "https://qa-connect-designvalidationrulemanagement.bentley.com";
    protected readonly RAS_URL = "https://qa-connect-resultsanalysisservice.bentley.com";
}