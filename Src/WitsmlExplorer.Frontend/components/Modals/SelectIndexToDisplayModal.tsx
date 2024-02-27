import {
  WITSML_INDEX_TYPE_DATE_TIME,
  WITSML_LOG_ORDERTYPE_DECREASING
} from "components/Constants";
import { LogCurveInfoRow } from "components/ContentViews/LogCurveInfoListView";
import ModalDialog from "components/Modals/ModalDialog";
import AdjustDateTimeModal from "components/Modals/TrimLogObject/AdjustDateTimeModal";
import AdjustNumberRangeModal from "components/Modals/TrimLogObject/AdjustNumberRangeModal";
import { SelectLogCurveInfoAction } from "contexts/navigationActions";
import NavigationType from "contexts/navigationType";
import { HideModalAction } from "contexts/operationStateReducer";
import OperationType from "contexts/operationType";
import LogObject from "models/logObject";
import React, { useEffect, useState } from "react";
import { formatIndexValue, indexToNumber } from "tools/IndexHelpers";

export interface SelectIndexToDisplayModalProps {
  dispatchNavigation: (action: SelectLogCurveInfoAction) => void;
  dispatchOperation: (action: HideModalAction) => void;
  selectedLogs: LogObject[];
  selectedLogCurveInfoRow: LogCurveInfoRow[];
}

function GetMax(arrayData: any[]) {
  return arrayData.reduce(function (a, b) {
    return a > b ? a : b;
  });
}
function GetMin(arrayData: any[]) {
  return arrayData.reduce(function (a, b) {
    return a < b ? a : b;
  });
}

const SelectIndexToDisplayModal = (
  props: SelectIndexToDisplayModalProps
): React.ReactElement => {
  const {
    selectedLogCurveInfoRow,
    dispatchNavigation,
    dispatchOperation,
    selectedLogs
  } = props;
  const pivotLog = selectedLogs[0];
  const isTimeIndexed = pivotLog.indexType === WITSML_INDEX_TYPE_DATE_TIME;
  const isIncreasing = pivotLog.direction != WITSML_LOG_ORDERTYPE_DECREASING;
  const [log, setLog] = useState<LogObject>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const startIndexes = selectedLogs.map((i) =>
    isTimeIndexed ? i.startIndex : indexToNumber(i.startIndex)
  );
  const endIndexes = selectedLogs.map((i) =>
    isTimeIndexed ? i.endIndex : indexToNumber(i.endIndex)
  );

  const maxRangeValue = GetMax([GetMax(startIndexes), GetMax(endIndexes)]);
  const minRangeValue = GetMin([GetMin(startIndexes), GetMin(endIndexes)]);

  const startIndexRow = isIncreasing ? minRangeValue : maxRangeValue;
  const endIndexRow = isIncreasing ? maxRangeValue : minRangeValue;

  const [startIndex, setStartIndex] = useState<string | number>(startIndexRow);
  const [endIndex, setEndIndex] = useState<string | number>(endIndexRow);
  const [confirmDisabled, setConfirmDisabled] = useState<boolean>();

  useEffect(() => {
    setLog(pivotLog);
  }, [pivotLog]);

  const onSubmit = async () => {
    setIsLoading(true);
    const logCurveInfoWithUpdatedIndex = selectedLogCurveInfoRow.map(
      (logCurveInfo: LogCurveInfoRow) => {
        return {
          ...logCurveInfo,
          minIndex: formatIndexValue(startIndex),
          maxIndex: formatIndexValue(endIndex)
        };
      }
    );
    dispatchOperation({ type: OperationType.HideModal });
    dispatchNavigation({
      type: NavigationType.ShowCurveValues,
      payload: { logCurveInfo: logCurveInfoWithUpdatedIndex }
    });
  };

  const toggleConfirmDisabled = (isValid: boolean) => {
    setConfirmDisabled(!isValid);
  };

  const correctDirectionOfLogs = selectedLogs.every(
    (i) => i.direction == pivotLog.direction
  );
  const selectedLogNames = selectedLogCurveInfoRow.map((i) => i.mnemonic);

  return (
    <>
      {!correctDirectionOfLogs ? (
        <ModalDialog
          heading={"Forbidden mix of logs"}
          isLoading={isLoading}
          onSubmit={onSubmit}
          content={
            <div>
              It is not allowed to select mix of different type directions of
              logs (increasing/decreasing)
            </div>
          }
        />
      ) : (
        log && (
          <ModalDialog
            heading={`Display curve values within selected index range for ${selectedLogNames.toString()}`}
            content={
              <>
                {isTimeIndexed ? (
                  <>
                    <AdjustDateTimeModal
                      minDate={String(startIndex)}
                      maxDate={String(endIndex)}
                      isDescending={
                        log.direction == WITSML_LOG_ORDERTYPE_DECREASING
                      }
                      onStartDateChanged={setStartIndex}
                      onEndDateChanged={setEndIndex}
                      onValidChange={toggleConfirmDisabled}
                    />
                  </>
                ) : (
                  <AdjustNumberRangeModal
                    minValue={indexToNumber(String(startIndex))}
                    maxValue={indexToNumber(String(endIndex))}
                    isDescending={
                      log.direction == WITSML_LOG_ORDERTYPE_DECREASING
                    }
                    onStartValueChanged={setStartIndex}
                    onEndValueChanged={setEndIndex}
                    onValidChange={toggleConfirmDisabled}
                  />
                )}
              </>
            }
            onSubmit={() => onSubmit()}
            isLoading={isLoading}
            confirmColor={"primary"}
            confirmText={"View curve values"}
            confirmDisabled={confirmDisabled}
          />
        )
      )}
    </>
  );
};

export default SelectIndexToDisplayModal;
