import { useRouter } from "next/router";
import { ParsedUrlQuery } from "querystring";
import React, { useContext, useEffect, useState } from "react";
import { NavigationAction } from "../contexts/navigationAction";
import {
  SelectLogObjectAction,
  SelectMudLogAction,
  SelectObjectGroupAction,
  SelectServerAction,
  SelectTrajectoryAction,
  SelectTubularAction,
  SelectWbGeometryAction,
  SelectWellAction,
  SelectWellboreAction,
  SetFilterAction
} from "../contexts/navigationActions";
import NavigationContext, { NavigationState } from "../contexts/navigationContext";
import NavigationType from "../contexts/navigationType";
import LogObject from "../models/logObject";
import MudLog from "../models/mudLog";
import { ObjectType } from "../models/objectType";
import { Server } from "../models/server";
import Trajectory from "../models/trajectory";
import Tubular from "../models/tubular";
import WbGeometryObject from "../models/wbGeometry";
import Well from "../models/well";
import Wellbore from "../models/wellbore";
import { truncateAbortHandler } from "../services/apiClient";
import BhaRunService from "../services/bhaRunService";
import LogObjectService from "../services/logObjectService";
import MessageObjectService from "../services/messageObjectService";
import MudLogService from "../services/mudLogService";
import NotificationService from "../services/notificationService";
import RigService from "../services/rigService";
import RiskObjectService from "../services/riskObjectService";
import TrajectoryService from "../services/trajectoryService";
import TubularService from "../services/tubularService";
import WbGeometryObjectService from "../services/wbGeometryService";

const Routing = (): React.ReactElement => {
  const { dispatchNavigation, navigationState } = useContext(NavigationContext);
  const {
    selectedServer,
    servers,
    wells,
    selectedWell,
    selectedWellbore,
    selectedLog,
    selectedMudLog,
    selectedObjectGroup,
    selectedTrajectory,
    selectedTubular,
    selectedWbGeometry
  } = navigationState;
  const router = useRouter();
  const [isSyncingUrlAndState, setIsSyncingUrlAndState] = useState<boolean>(true);
  const [hasSelectedServer, setHasSelectedServer] = useState<boolean>(false);
  const [urlParams, setUrlParams] = useState<QueryParams>(null);
  const [currentQueryParams, setCurrentQueryParams] = useState<QueryParams>(null);

  useEffect(() => {
    //set initial params state
    if (isSyncingUrlAndState) {
      setUrlParams(getQueryParamsFromUrl(router.query));
      setCurrentQueryParams(getQueryParamsFromState(navigationState));
    }
  }, [router]);

  useEffect(() => {
    // update params on navigation state change
    setCurrentQueryParams(getQueryParamsFromState(navigationState));
    const finishedSyncingStateAndUrl = isSyncingUrlAndState && urlParams && isQueryParamsEqual(urlParams, currentQueryParams);
    if (finishedSyncingStateAndUrl) {
      setIsSyncingUrlAndState(false);
    }
  }, [selectedServer, selectedWell, selectedWellbore, selectedLog, selectedTubular, selectedMudLog, selectedObjectGroup, selectedTrajectory, selectedWbGeometry]);

  useEffect(() => {
    //update router on params change
    if (!isSyncingUrlAndState) {
      router.push({
        pathname: "/",
        query: { ...currentQueryParams }
      });
    }
  }, [currentQueryParams, isSyncingUrlAndState]);

  useEffect(() => {
    // update selected server when servers are fetched
    if (isSyncingUrlAndState && urlParams) {
      const serverUrl = urlParams.serverUrl;
      const server = servers.find((server: Server) => server.url === serverUrl);
      if (server && !selectedServer) {
        if (hasSelectedServer) {
          // finish syncing if we already attempted to select a server (such as on login cancellation)
          setIsSyncingUrlAndState(false);
        } else {
          setHasSelectedServer(true);
          const action: SelectServerAction = { type: NavigationType.SelectServer, payload: { server } };
          dispatchNavigation(action);
        }
      }
    }
  }, [servers, urlParams]);

  useEffect(() => {
    // update selected well when wells are fetched
    if (isSyncingUrlAndState && urlParams) {
      const wellUid = urlParams.wellUid;
      if (wellUid != null && !selectedWell && wells.length > 0) {
        const well: Well = wells.find((w: Well) => w.uid === wellUid);
        if (well) {
          const selectWellAction: SelectWellAction = { type: NavigationType.SelectWell, payload: { well, wellbores: well.wellbores } };
          dispatchNavigation(selectWellAction);
        } else {
          NotificationService.Instance.alertDispatcher.dispatch({
            serverUrl: new URL(selectedServer?.url),
            message: `Well with UID ${wellUid} was not found on the current server.`,
            isSuccess: false
          });
          setIsSyncingUrlAndState(false);
        }
      } else if (wellUid == null) {
        setIsSyncingUrlAndState(false);
      }
    }
  }, [wells]);

  useEffect(() => {
    if (isSyncingUrlAndState && selectedWell) {
      const setFilterAction: SetFilterAction = { type: NavigationType.SetFilter, payload: { filter: { ...navigationState.selectedFilter, wellName: selectedWell.name } } };
      dispatchNavigation(setFilterAction);
    }
  }, [selectedWell]);

  useEffect(() => {
    // fetch wellbore objects once a well is selected
    const shouldNavigateToWellbore = isSyncingUrlAndState && selectedWell && urlParams?.wellboreUid && !selectedWellbore;
    if (shouldNavigateToWellbore) {
      const wellboreUid = urlParams.wellboreUid.toString();
      const controller = new AbortController();

      const getChildren = async () => {
        const getBhaRuns = BhaRunService.getBhaRuns(selectedWell.uid, wellboreUid, controller.signal);
        const getLogs = LogObjectService.getLogs(selectedWell.uid, wellboreUid, controller.signal);
        const getRigs = RigService.getRigs(selectedWell.uid, wellboreUid, controller.signal);
        const getTrajectories = TrajectoryService.getTrajectories(selectedWell.uid, wellboreUid, controller.signal);
        const getTubulars = TubularService.getTubulars(selectedWell.uid, wellboreUid, controller.signal);
        const getMessages = MessageObjectService.getMessages(selectedWell.uid, wellboreUid, controller.signal);
        const getMudLogs = MudLogService.getMudLogs(selectedWell.uid, wellboreUid, controller.signal);
        const getRisks = RiskObjectService.getRisks(selectedWell.uid, wellboreUid, controller.signal);
        const getWbGeometrys = WbGeometryObjectService.getWbGeometrys(selectedWell.uid, wellboreUid, controller.signal);
        const [bhaRuns, logs, rigs, trajectories, messages, mudLogs, risks, tubulars, wbGeometrys] = await Promise.all([
          getBhaRuns,
          getLogs,
          getRigs,
          getTrajectories,
          getMessages,
          getMudLogs,
          getRisks,
          getTubulars,
          getWbGeometrys
        ]);
        const wellbore: Wellbore = selectedWell.wellbores.find((wb: Wellbore) => wb.uid === wellboreUid);
        if (wellbore) {
          const selectWellbore: SelectWellboreAction = {
            type: NavigationType.SelectWellbore,
            payload: { well: selectedWell, wellbore, bhaRuns, logs, rigs, trajectories, messages, mudLogs, risks, tubulars, wbGeometrys }
          } as SelectWellboreAction;
          dispatchNavigation(selectWellbore);
        } else {
          NotificationService.Instance.alertDispatcher.dispatch({
            serverUrl: new URL(selectedServer?.url),
            message: `Wellbore with UID ${wellboreUid} was not found on the ${selectedWell.name} well.`,
            isSuccess: false
          });
          setIsSyncingUrlAndState(false);
        }
      };

      getChildren().catch(truncateAbortHandler);
      return () => {
        controller.abort();
      };
    } else if (selectedWell && urlParams?.wellboreUid == null) {
      setIsSyncingUrlAndState(false);
    }
  }, [selectedWell]);

  useEffect(() => {
    if (isSyncingUrlAndState && selectedWellbore) {
      const dispatch = (action: NavigationAction, object: any = true, uid = "") => {
        if (object) {
          dispatchNavigation(action);
        } else {
          NotificationService.Instance.alertDispatcher.dispatch({
            serverUrl: new URL(selectedServer?.url),
            message: `Unable to ${action.type} with UID ${uid} on the ${selectedWellbore.name} wellbore as the object was not found.`,
            isSuccess: false
          });
        }
        setIsSyncingUrlAndState(false);
      };

      const bhaRunGroupUid = urlParams?.bhaRunGroupUid?.toString();
      const logObjectUid = urlParams?.logObjectUid?.toString();
      const messageGroupUid = urlParams?.messageGroupUid?.toString();
      const mudLogGroupUid = urlParams?.mudLogGroupUid?.toString();
      const mudLogUid = urlParams?.mudLogUid?.toString();
      const rigGroupUid = urlParams?.rigGroupUid?.toString();
      const riskGroupUid = urlParams?.riskGroupUid?.toString();
      const trajectoryUid = urlParams?.trajectoryUid?.toString();
      const tubularUid = urlParams?.tubularUid?.toString();
      const wbGeometryUid = urlParams?.wbGeometryUid?.toString();
      if (bhaRunGroupUid && selectedObjectGroup !== ObjectType.BhaRun) {
        const action: SelectObjectGroupAction = {
          type: NavigationType.SelectObjectGroup,
          payload: { objectType: ObjectType.BhaRun, well: selectedWell, wellbore: selectedWellbore }
        };
        dispatch(action);
      } else if (logObjectUid && !selectedLog) {
        const log = selectedWellbore.logs.find((l: LogObject) => l.uid === logObjectUid);
        const selectLogObjectAction: SelectLogObjectAction = { type: NavigationType.SelectLogObject, payload: { log, well: selectedWell, wellbore: selectedWellbore } };
        dispatch(selectLogObjectAction, log, logObjectUid);
      } else if (messageGroupUid && selectedObjectGroup !== ObjectType.Message) {
        const action: SelectObjectGroupAction = {
          type: NavigationType.SelectObjectGroup,
          payload: { objectType: ObjectType.Message, well: selectedWell, wellbore: selectedWellbore }
        };
        dispatch(action);
      } else if (mudLogUid && !selectedMudLog) {
        const mudLog = selectedWellbore.mudLogs.find((t: MudLog) => t.uid === mudLogUid);
        const selectMudLogAction: SelectMudLogAction = {
          type: NavigationType.SelectMudLog,
          payload: { well: selectedWell, wellbore: selectedWellbore, mudLog }
        };
        dispatch(selectMudLogAction, mudLog, mudLogUid);
      } else if (mudLogGroupUid && selectedObjectGroup !== ObjectType.MudLog) {
        const action: SelectObjectGroupAction = {
          type: NavigationType.SelectObjectGroup,
          payload: { objectType: ObjectType.MudLog, well: selectedWell, wellbore: selectedWellbore }
        };
        dispatch(action);
      } else if (rigGroupUid && selectedObjectGroup !== ObjectType.Rig) {
        const action: SelectObjectGroupAction = {
          type: NavigationType.SelectObjectGroup,
          payload: { objectType: ObjectType.Rig, well: selectedWell, wellbore: selectedWellbore }
        };
        dispatch(action);
      } else if (riskGroupUid && selectedObjectGroup !== ObjectType.Risk) {
        const action: SelectObjectGroupAction = {
          type: NavigationType.SelectObjectGroup,
          payload: { objectType: ObjectType.Risk, well: selectedWell, wellbore: selectedWellbore }
        };
        dispatch(action);
      } else if (trajectoryUid && !selectedTrajectory) {
        const trajectory = selectedWellbore.trajectories.find((t: Trajectory) => t.uid === trajectoryUid);
        const selectTrajectoryAction: SelectTrajectoryAction = {
          type: NavigationType.SelectTrajectory,
          payload: { well: selectedWell, wellbore: selectedWellbore, trajectory }
        };
        dispatch(selectTrajectoryAction, trajectory, trajectoryUid);
      } else if (tubularUid && !selectedTubular) {
        const tubular = selectedWellbore.tubulars.find((t: Tubular) => t.uid === tubularUid);
        const selectTubularAction: SelectTubularAction = {
          type: NavigationType.SelectTubular,
          payload: { well: selectedWell, wellbore: selectedWellbore, tubular }
        };
        dispatch(selectTubularAction, tubular, tubularUid);
      } else if (wbGeometryUid && !selectedWbGeometry) {
        const wbGeometry = selectedWellbore.wbGeometrys.find((object: WbGeometryObject) => object.uid === wbGeometryUid);
        const action: SelectWbGeometryAction = {
          type: NavigationType.SelectWbGeometry,
          payload: { well: selectedWell, wellbore: selectedWellbore, wbGeometry }
        };
        dispatch(action, wbGeometry, wbGeometryUid);
      } else {
        setIsSyncingUrlAndState(false);
      }
    }
  }, [selectedWellbore]);

  return <></>;
};

const isQueryParamsEqual = (urlQp: QueryParams, stateQp: QueryParams): boolean => {
  if (Object.keys(urlQp).length !== Object.keys(urlQp).length) {
    return false;
  }

  return (Object.keys(urlQp) as (keyof typeof urlQp)[]).every((key) => {
    return Object.prototype.hasOwnProperty.call(stateQp, key) && urlQp[key] === stateQp[key];
  });
};

export const getQueryParamsFromState = (state: NavigationState): QueryParams => {
  return {
    ...(state.selectedServer && { serverUrl: state.selectedServer.url }),
    ...(state.selectedWell && { wellUid: state.selectedWell.uid }),
    ...(state.selectedWellbore && { wellboreUid: state.selectedWellbore.uid }),
    ...(state.selectedObjectGroup === ObjectType.BhaRun && { bhaRunGroupUid: "group" }),
    ...(state.selectedLog && { logObjectUid: state.selectedLog.uid }),
    ...(state.selectedObjectGroup === ObjectType.Message && { messageGroupUid: "group" }),
    ...(state.selectedObjectGroup === ObjectType.MudLog && { mudLogGroupUid: "group" }),
    ...(state.selectedObjectGroup === ObjectType.Rig && { rigGroupUid: "group" }),
    ...(state.selectedObjectGroup === ObjectType.Risk && { riskGroupUid: "group" }),
    ...(state.selectedTrajectory && { trajectoryUid: state.selectedTrajectory.uid }),
    ...(state.selectedTubular && { tubularUid: state.selectedTubular.uid }),
    ...(state.selectedMudLog && { mudLogUid: state.selectedMudLog.uid }),
    ...(state.selectedWbGeometry && { wbGeometryUid: state.selectedWbGeometry.uid })
  };
};

export const getQueryParamsFromUrl = (query: ParsedUrlQuery): QueryParams => {
  return {
    ...(query.serverUrl && { serverUrl: query.serverUrl.toString() }),
    ...(query.wellUid && { wellUid: query.wellUid.toString() }),
    ...(query.wellboreUid && { wellboreUid: query.wellboreUid.toString() }),
    ...(query.bhaRunGroupUid && { bhaRunGroupUid: query.bhaRunGroupUid.toString() }),
    ...(query.logObjectUid && { logObjectUid: query.logObjectUid.toString() }),
    ...(query.messageGroupUid && { messageGroupUid: query.messageGroupUid.toString() }),
    ...(query.mudLogGroupUid && { mudLogGroupUid: query.mudLogGroupUid.toString() }),
    ...(query.mudLogUid && { mudLogUid: query.mudLogUid.toString() }),
    ...(query.rigGroupUid && { rigGroupUid: query.rigGroupUid.toString() }),
    ...(query.riskGroupUid && { riskGroupUid: query.riskGroupUid.toString() }),
    ...(query.trajectoryUid && { trajectoryUid: query.trajectoryUid.toString() }),
    ...(query.tubularUid && { tubularUid: query.tubularUid.toString() }),
    ...(query.wbGeometryUid && { wbGeometryUid: query.wbGeometryUid.toString() })
  };
};

export interface QueryParams {
  serverUrl: string;
  wellUid?: string;
  wellboreUid?: string;
  bhaRunGroupUid?: string;
  logObjectUid?: string;
  messageGroupUid?: string;
  mudLogGroupUid?: string;
  mudLogUid?: string;
  rigGroupUid?: string;
  riskGroupUid?: string;
  trajectoryUid?: string;
  tubularUid?: string;
  wbGeometryUid?: string;
}

export default Routing;
