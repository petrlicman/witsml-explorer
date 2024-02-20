import { Switch, Typography } from "@equinor/eds-core-react";
import React, { useContext, useEffect, useState } from "react";
import { timeFromMinutesToMilliseconds } from "../../contexts/curveThreshold";
import NavigationContext from "../../contexts/navigationContext";
import OperationContext from "../../contexts/operationContext";
import OperationType from "../../contexts/operationType";
import LogCurveInfo, { isNullOrEmptyIndex } from "../../models/logCurveInfo";
import { measureToString } from "../../models/measure";
import { truncateAbortHandler } from "../../services/apiClient";
import { getContextMenuPosition } from "../ContextMenus/ContextMenu";
import LogCurveInfoContextMenu, {
  LogCurveInfoContextMenuProps
} from "../ContextMenus/LogCurveInfoContextMenu";
import formatDateString from "../DateFormatter";
import { CommonPanelContainer } from "./CurveValuesView";
import {
  ContentTable,
  ContentTableColumn,
  ContentTableRow,
  ContentType
} from "./table";
import LogObjectService from "../../services/logObjectService";
import Wellbore from "../../models/wellbore";
import Well from "../../models/well";

export interface LogCurveInfoRow extends ContentTableRow {
  uid: string;
  mnemonic: string;
  logName: string;
  minIndex: number | Date;
  maxIndex: number | Date;
  classWitsml: string;
  unit: string;
  mnemAlias: string;
  logUid: string;
  wellUid: string;
  wellboreUid: string;
  wellName: string;
  wellboreName: string;
  isActive: boolean;
  logCurveInfo: LogCurveInfo;
}

export const LogCurveInfoListView = (): React.ReactElement => {
  const { navigationState, dispatchNavigation } = useContext(NavigationContext);
  const {
    operationState: { timeZone, dateTimeFormat }
  } = useContext(OperationContext);
  const {
    selectedServer,
    selectedWell,
    selectedWellbore,
    selectedLogs,
    selectedCurveThreshold,
    servers
  } = navigationState;
  const { dispatchOperation } = useContext(OperationContext);
  const [logCurveInfoList, setLogCurveInfoList] = useState<LogCurveInfo[]>([]);
  const isDepthIndex = !!logCurveInfoList?.[0]?.maxDepthIndex;
  const [isFetchingData, setIsFetchingData] = useState<boolean>(true);
  const [hideEmptyMnemonics, setHideEmptyMnemonics] = useState<boolean>(false);

  useEffect(() => {
    setIsFetchingData(true);
    if (selectedLogs && selectedLogs.length > 0) {
      const controller = new AbortController();

      const getLogCurveInfo = async () => {
        const logCurveInfo = await LogObjectService.getMnemonicsInLogs(
          selectedWell.uid,
          selectedWellbore.uid,
          selectedLogs.map((x) => x.uid),
          undefined
        );
        setLogCurveInfoList(logCurveInfo);
        setIsFetchingData(false);
      };

      getLogCurveInfo().catch(truncateAbortHandler);

      return () => {
        controller.abort();
      };
    }
  }, [selectedLogs]);

  const onContextMenu = (
    event: React.MouseEvent<HTMLLIElement>,
    {},
    checkedLogCurveInfoRows: LogCurveInfoRow[]
  ) => {
    const contextMenuProps: LogCurveInfoContextMenuProps = {
      checkedLogCurveInfoRows,
      dispatchOperation,
      dispatchNavigation,
      selectedLogs,
      selectedServer,
      servers
    };
    const position = getContextMenuPosition(event);
    dispatchOperation({
      type: OperationType.DisplayContextMenu,
      payload: {
        component: <LogCurveInfoContextMenu {...contextMenuProps} />,
        position
      }
    });
  };

  const calculateIsCurveActive = (
    logCurveInfo: LogCurveInfo,
    maxDepth: number
  ): boolean => {
    if (isDepthIndex) {
      return (
        maxDepth - parseFloat(logCurveInfo.maxDepthIndex) <
        selectedCurveThreshold.depthInMeters
      );
    } else {
      const dateDifferenceInMilliseconds =
        new Date().valueOf() -
        new Date(logCurveInfo.maxDateTimeIndex).valueOf();
      return (
        dateDifferenceInMilliseconds <
        timeFromMinutesToMilliseconds(selectedCurveThreshold.timeInMinutes)
      );
    }
  };

  const getTableData = () => {
    const maxDepth = Math.max(
      ...logCurveInfoList.map((x) => parseFloat(x.maxDepthIndex))
    );

    return logCurveInfoList
      .map((logCurveInfo) => {
        const isActive =
          selectedLogs[0].objectGrowing &&
          calculateIsCurveActive(logCurveInfo, maxDepth);
        return {
          id: `${selectedLogs[0].uid}-${logCurveInfo.mnemonic}`,
          uid: logCurveInfo.uid,
          mnemonic: logCurveInfo.mnemonic,
          logName: logCurveInfo.logName,
          minIndex: isDepthIndex
            ? logCurveInfo.minDepthIndex
            : formatDateString(
                logCurveInfo.minDateTimeIndex,
                timeZone,
                dateTimeFormat
              ),
          maxIndex: isDepthIndex
            ? logCurveInfo.maxDepthIndex
            : formatDateString(
                logCurveInfo.maxDateTimeIndex,
                timeZone,
                dateTimeFormat
              ),
          classWitsml: logCurveInfo.classWitsml,
          unit: logCurveInfo.unit,
          sensorOffset: measureToString(logCurveInfo.sensorOffset),
          mnemAlias: logCurveInfo.mnemAlias,
          logUid: selectedLogs[0].uid,
          wellUid: selectedWell.uid,
          wellboreUid: selectedWellbore.uid,
          wellName: selectedWell.name,
          wellboreName: selectedWellbore.name,
          isActive: isActive,
          isVisibleFunction: isVisibleFunction(isActive),
          logCurveInfo
        };
      })
      .sort((curve, curve2) => {
        if (selectedLogs.length == 1) {
          if (
            curve.mnemonic.toLowerCase() ===
            selectedLogs[0].indexCurve?.toLowerCase()
          ) {
            return -1;
          } else if (
            curve2.mnemonic.toLowerCase() ===
            selectedLogs[0].indexCurve?.toLowerCase()
          ) {
            return 1;
          }
          return curve.mnemonic.localeCompare(curve2.mnemonic);
        } else {
          return curve.logName.localeCompare(curve2.logName);
        }
      });
  };

  const isVisibleFunction = (isActive: boolean): (() => boolean) => {
    return () => {
      if (isDepthIndex) return true;
      return !(selectedCurveThreshold.hideInactiveCurves && !isActive);
    };
  };
  const ToolTip = (well: Well, wellBore: Wellbore): React.ReactNode => {
    return (
      <>
        <div>Well UID: {well.uid}</div>
        <div>Well name : {well.name}</div>
        <div>WellBore UID : {wellBore.uid}</div>
        <div>WellBore name : {wellBore.name}</div>
      </>
    );
  };

  const columns: ContentTableColumn[] = [
    ...(!isDepthIndex
      ? [{ property: "isActive", label: "active", type: ContentType.String }]
      : []),
    {
      property: "mnemonic",
      label: "mnemonic",
      type: ContentType.String,
      toolTip: ToolTip(selectedWell, selectedWellbore)
    },
    {
      property: "logName",
      label: "log name",
      type: ContentType.String,
      toolTip: ToolTip(selectedWell, selectedWellbore)
    },
    {
      property: "minIndex",
      label: "minIndex",
      type: isDepthIndex ? ContentType.Number : ContentType.DateTime,
      filterFn: (row) => {
        return (
          !hideEmptyMnemonics || !isNullOrEmptyIndex(row.original.minIndex)
        );
      }
    },
    {
      property: "maxIndex",
      label: "maxIndex",
      type: isDepthIndex ? ContentType.Number : ContentType.DateTime
    },
    { property: "classWitsml", label: "classWitsml", type: ContentType.String },
    { property: "unit", label: "unit", type: ContentType.String },
    {
      property: "sensorOffset",
      label: "sensorOffset",
      type: ContentType.Measure
    },
    { property: "mnemAlias", label: "mnemAlias", type: ContentType.String },
    { property: "uid", label: "uid", type: ContentType.String }
  ];

  const panelElements = [
    <CommonPanelContainer key="hideEmptyMnemonics">
      <Switch
        checked={hideEmptyMnemonics}
        onChange={() => setHideEmptyMnemonics(!hideEmptyMnemonics)}
      />
      <Typography>Hide Empty Curves</Typography>
    </CommonPanelContainer>
  ];

  return selectedLogs && !isFetchingData ? (
    <ContentTable
      viewId={
        isDepthIndex ? "depthLogCurveInfoListView" : "timeLogCurveInfoListView"
      }
      panelElements={panelElements}
      columns={columns}
      data={getTableData()}
      onContextMenu={onContextMenu}
      checkableRows
      showRefresh
      downloadToCsvFileName={`LogCurveInfo_${selectedLogs[0].name}`}
    />
  ) : (
    <></>
  );
};

export default LogCurveInfoListView;
