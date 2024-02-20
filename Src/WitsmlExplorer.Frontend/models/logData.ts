export interface LogData {
  startIndex: string;
  endIndex: string;
  curveSpecifications: CurveSpecification[];
  data: LogDataRow[];
}

export interface CurveSpecification {
  mnemonic: string;
  unit: string;
  logUid: string;
}

export interface LogDataRow {
  [key: string]: number | string | boolean;
}

export class LogDataRequestQuery {
  mnemonics: string[];
  logUid: string;

  constructor(logUid: string, mnemonics: string[]) {
    this.logUid = logUid;
    this.mnemonics = mnemonics;
  }
}
