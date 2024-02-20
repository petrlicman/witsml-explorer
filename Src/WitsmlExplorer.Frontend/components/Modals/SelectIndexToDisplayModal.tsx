import React, { useEffect, useState } from "react";
import { SelectLogCurveInfoAction } from "../../contexts/navigationActions";
import NavigationType from "../../contexts/navigationType";
import { HideModalAction } from "../../contexts/operationStateReducer";
import OperationType from "../../contexts/operationType";
import LogObject from "../../models/logObject";
import {
  WITSML_INDEX_TYPE_DATE_TIME,
  WITSML_LOG_ORDERTYPE_DECREASING
} from "../Constants";
import { LogCurveInfoRow } from "../ContentViews/LogCurveInfoListView";
import ModalDialog from "./ModalDialog";
import AdjustDateTimeModal from "./TrimLogObject/AdjustDateTimeModal";
import AdjustNumberRangeModal from "./TrimLogObject/AdjustNumberRangeModal";
import { formatIndexValue, indexToNumber } from "../../tools/IndexHelpers";

export interface SelectIndexToDisplayModalProps {
  dispatchNavigation: (action: SelectLogCurveInfoAction) => void;
  dispatchOperation: (action: HideModalAction) => void;
  selectedLogs: LogObject[];
  selectedLogCurveInfoRow: LogCurveInfoRow[];
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
  const isTimeIndexed =
    selectedLogs[0].indexType === WITSML_INDEX_TYPE_DATE_TIME;
  const [log, setLog] = useState<LogObject>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const startIndexRow = selectedLogs.reduce(function (a, b) {
    return a.direction == WITSML_LOG_ORDERTYPE_DECREASING
      ? a.startIndex > b.startIndex
        ? a
        : b
      : a.startIndex < b.startIndex
      ? a
      : b;
  });
  const endIndexRow = selectedLogs.reduce(function (a, b) {
    return a.direction == WITSML_LOG_ORDERTYPE_DECREASING
      ? a.endIndex < b.endIndex
        ? a
        : b
      : a.endIndex > b.endIndex
      ? a
      : b;
  });
  const [startIndex, setStartIndex] = useState<string | number>(
    isTimeIndexed
      ? startIndexRow.startIndex
      : indexToNumber(startIndexRow.startIndex)
  );
  const [endIndex, setEndIndex] = useState<string | number>(
    isTimeIndexed ? endIndexRow.endIndex : indexToNumber(endIndexRow.endIndex)
  );
  const [confirmDisabled, setConfirmDisabled] = useState<boolean>();

  useEffect(() => {
    setLog(selectedLogs[0]);
  }, [selectedLogs[0]]);

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

  const pivotLog = selectedLogs[0];
  const correctDirectionOfLogs = selectedLogs.every(
    (i) => i.direction == pivotLog.direction
  );

  return (
    <>
      {!correctDirectionOfLogs ? (
        <ModalDialog
          heading={"Wrong mix of directions"}
          isLoading={isLoading}
          onSubmit={onSubmit}
          content={<div>WRONG</div>}
        />
      ) : (
        log && (
          <ModalDialog
            heading={`Display curve values within selected index range for ${log.name}`}
            content={
              <>
                {isTimeIndexed ? (
                  <>
                    <AdjustDateTimeModal
                      minDate={log.startIndex}
                      maxDate={log.endIndex}
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
                    minValue={indexToNumber(log.startIndex)}
                    maxValue={indexToNumber(log.endIndex)}
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
