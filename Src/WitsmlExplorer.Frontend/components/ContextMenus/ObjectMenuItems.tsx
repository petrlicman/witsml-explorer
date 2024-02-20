import { Typography } from "@equinor/eds-core-react";
import { Divider, MenuItem } from "@material-ui/core";
import React from "react";
import { v4 as uuid } from "uuid";
import { DispatchNavigation } from "../../contexts/navigationAction";
import { NavigationState } from "../../contexts/navigationContext";
import { DispatchOperation } from "../../contexts/operationStateReducer";
import { OpenInQueryView } from "../../hooks/useOpenInQueryView";
import LogObject from "../../models/logObject";
import ObjectOnWellbore from "../../models/objectOnWellbore";
import { ObjectType } from "../../models/objectType";
import { Server } from "../../models/server";
import Wellbore from "../../models/wellbore";
import { colors } from "../../styles/Colors";
import {
  ObjectTypeToTemplateObject,
  StoreFunction
} from "../ContentViews/QueryViewUtils";
import {
  StyledIcon,
  menuItemText,
  onClickDeleteObjects,
  onClickRefreshObject,
  onClickShowGroupOnServer
} from "./ContextMenuUtils";
import { onClickCopyToServer } from "./CopyToServer";
import { copyObjectOnWellbore, pasteObjectOnWellbore } from "./CopyUtils";
import NestedMenuItem from "./NestedMenuItem";
import { useClipboardReferencesOfType } from "./UseClipboardReferences";
import OperationType from "../../contexts/operationType";
import NavigationType from "../../contexts/navigationType";
import Well from "../../models/well";

export interface ObjectContextMenuProps {
  checkedObjects: ObjectOnWellbore[];
  well: Well;
  wellbore: Wellbore;
}

export const ObjectMenuItems = (
  checkedObjects: ObjectOnWellbore[],
  objectType: ObjectType,
  navigationState: NavigationState,
  dispatchOperation: DispatchOperation,
  dispatchNavigation: DispatchNavigation,
  openInQueryView: OpenInQueryView,
  well: Well,
  wellbore: Wellbore,
  extraMenuItems: React.ReactElement[]
): React.ReactElement[] => {
  const objectReferences = useClipboardReferencesOfType(objectType);
  const { selectedServer, servers } = navigationState;

  return [
    // ------- OPEN
    <MenuItem
      key={"open"}
      onClick={() =>
        onClickOpen(
          dispatchOperation,
          dispatchNavigation,
          well,
          wellbore,
          checkedObjects
        )
      }
      disabled={checkedObjects.length == 0}
    >
      <StyledIcon name="folderOpen" color={colors.interactive.primaryResting} />
      <Typography color={"primary"}>
        {menuItemText("Open", objectType, null)}
      </Typography>
    </MenuItem>,
    <MenuItem
      key={"refresh"}
      onClick={() =>
        onClickRefreshObject(
          checkedObjects[0],
          objectType,
          dispatchOperation,
          dispatchNavigation
        )
      }
      disabled={checkedObjects.length !== 1}
    >
      <StyledIcon name="refresh" color={colors.interactive.primaryResting} />
      <Typography color={"primary"}>
        {menuItemText("Refresh", objectType, null)}
      </Typography>
    </MenuItem>,
    <Divider key={"objectMenuItemsDivider"} />,
    <MenuItem
      key={"copy"}
      onClick={() =>
        copyObjectOnWellbore(
          selectedServer,
          checkedObjects,
          dispatchOperation,
          objectType
        )
      }
      disabled={checkedObjects.length === 0}
    >
      <StyledIcon name="copy" color={colors.interactive.primaryResting} />
      <Typography color={"primary"}>
        {menuItemText("copy", objectType, checkedObjects)}
      </Typography>
    </MenuItem>,
    <NestedMenuItem
      key={"copyToServer"}
      label={`${menuItemText("copy", objectType, checkedObjects)} to server`}
      disabled={checkedObjects.length === 0}
    >
      {servers.map(
        (server: Server) =>
          server.id !== selectedServer.id && (
            <MenuItem
              key={server.name}
              onClick={() =>
                onClickCopyToServer(
                  server,
                  selectedServer,
                  checkedObjects,
                  objectType,
                  dispatchOperation
                )
              }
              disabled={checkedObjects.length === 0}
            >
              <Typography color={"primary"}>{server.name}</Typography>
            </MenuItem>
          )
      )}
    </NestedMenuItem>,
    <MenuItem
      key={"pasteObject"}
      onClick={() =>
        pasteObjectOnWellbore(
          servers,
          objectReferences,
          dispatchOperation,
          wellbore
        )
      }
      disabled={objectReferences === null}
    >
      <StyledIcon name="paste" color={colors.interactive.primaryResting} />
      <Typography color={"primary"}>
        {menuItemText("paste", objectType, objectReferences?.objectUids)}
      </Typography>
    </MenuItem>,
    <MenuItem
      key={"delete"}
      onClick={() =>
        onClickDeleteObjects(dispatchOperation, checkedObjects, objectType)
      }
      disabled={checkedObjects.length === 0}
    >
      <StyledIcon
        name="deleteToTrash"
        color={colors.interactive.primaryResting}
      />
      <Typography color={"primary"}>
        {menuItemText("delete", objectType, checkedObjects)}
      </Typography>
    </MenuItem>,
    ...extraMenuItems,
    <NestedMenuItem
      key={"showOnServer"}
      label={"Show on server"}
      disabled={checkedObjects.length !== 1}
    >
      {servers.map((server: Server) => (
        <MenuItem
          key={server.name}
          onClick={() =>
            onClickShowGroupOnServer(
              dispatchOperation,
              server,
              wellbore,
              objectType,
              (checkedObjects[0] as LogObject)?.indexType
            )
          }
          disabled={checkedObjects.length !== 1}
        >
          <Typography color={"primary"}>{server.name}</Typography>
        </MenuItem>
      ))}
    </NestedMenuItem>,
    <NestedMenuItem key={"queryItems"} label={"Query"} icon="textField">
      {[
        <MenuItem
          key={"openInQueryView"}
          disabled={checkedObjects.length != 1}
          onClick={() =>
            openInQueryView({
              templateObject: ObjectTypeToTemplateObject[objectType],
              storeFunction: StoreFunction.GetFromStore,
              wellUid: wellbore.wellUid,
              wellboreUid: wellbore.uid,
              objectUid: checkedObjects[0].uid
            })
          }
        >
          <StyledIcon
            name="textField"
            color={colors.interactive.primaryResting}
          />
          <Typography color={"primary"}>Open in query view</Typography>
        </MenuItem>,
        <MenuItem
          key={"newObject"}
          disabled={checkedObjects.length != 1}
          onClick={() =>
            openInQueryView({
              templateObject: ObjectTypeToTemplateObject[objectType],
              storeFunction: StoreFunction.AddToStore,
              wellUid: wellbore.wellUid,
              wellboreUid: wellbore.uid,
              objectUid: uuid()
            })
          }
        >
          <StyledIcon name="add" color={colors.interactive.primaryResting} />
          <Typography color={"primary"}>{`New ${objectType}`}</Typography>
        </MenuItem>
      ]}
    </NestedMenuItem>
  ];
};

export const onClickOpen = (
  dispatchOperation: DispatchOperation,
  dispatchNavigation: DispatchNavigation,
  well: Well,
  wellbore: Wellbore,
  checkedItems: ObjectOnWellbore[]
) => {
  dispatchOperation({ type: OperationType.HideContextMenu });
  dispatchNavigation({
    type: NavigationType.SelectLog,
    payload: {
      well: well,
      wellbore: wellbore,
      selectedLogs: checkedItems
    }
  });
};
