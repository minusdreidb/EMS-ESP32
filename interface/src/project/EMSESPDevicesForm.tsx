import React, { Component, Fragment } from "react";
import { withStyles, Theme, createStyles } from "@material-ui/core/styles";

import {
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer, withWidth, WithWidthProps, isWidthDown,
  Button, Tooltip, DialogTitle, DialogContent, DialogActions, Box, Dialog, Typography
} from "@material-ui/core";

import RefreshIcon from "@material-ui/icons/Refresh";
import ListIcon from "@material-ui/icons/List";
import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';

import { redirectingAuthorizedFetch, withAuthenticatedContext, AuthenticatedContextProps } from "../authentication";
import { RestFormProps, FormButton, extractEventValue } from "../components";

import { EMSESPDevices, EMSESPDeviceData, Device, DeviceValue } from "./EMSESPtypes";

import ValueForm from './ValueForm';

import { ENDPOINT_ROOT } from "../api";

export const SCANDEVICES_ENDPOINT = ENDPOINT_ROOT + "scanDevices";
export const DEVICE_DATA_ENDPOINT = ENDPOINT_ROOT + "deviceData";
export const WRITE_VALUE_ENDPOINT = ENDPOINT_ROOT + "writeValue";

const StyledTableCell = withStyles((theme: Theme) =>
  createStyles({
    head: {
      backgroundColor: theme.palette.common.black,
      color: theme.palette.common.white,
    },
    body: {
      fontSize: 14,
    },
  })
)(TableCell);

const CustomTooltip = withStyles((theme: Theme) => ({
  tooltip: {
    backgroundColor: theme.palette.secondary.main,
    color: 'white',
    boxShadow: theme.shadows[1],
    fontSize: 11,
    border: '1px solid #dadde9',
  },
}))(Tooltip);

function compareDevices(a: Device, b: Device) {
  if (a.type < b.type) {
    return -1;
  }
  if (a.type > b.type) {
    return 1;
  }
  return 0;
}

interface EMSESPDevicesFormState {
  confirmScanDevices: boolean;
  processing: boolean;
  deviceData?: EMSESPDeviceData;
  selectedDevice?: number;
  devicevalue?: DeviceValue;
}

type EMSESPDevicesFormProps = RestFormProps<EMSESPDevices> & AuthenticatedContextProps & WithWidthProps;

function formatTemp(t: string) {
  if (t == null) {
    return "n/a";
  }
  return t + " °C";
}

function formatUnit(u: string) {
  if (u == null) {
    return u;
  }
  return " " + u;
}

class EMSESPDevicesForm extends Component<EMSESPDevicesFormProps, EMSESPDevicesFormState> {
  state: EMSESPDevicesFormState = {
    confirmScanDevices: false,
    processing: false
  };

  handleValueChange = (name: keyof DeviceValue) => (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ devicevalue: { ...this.state.devicevalue!, [name]: extractEventValue(event) } });
  };

  cancelEditingValue = () => {
    this.setState({
      devicevalue: undefined
    });
  }

  doneEditingValue = () => {
    const { devicevalue } = this.state;

    redirectingAuthorizedFetch(WRITE_VALUE_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({ devicevalue: devicevalue }),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        if (response.status === 200) {
          this.props.enqueueSnackbar("Write command sent to device", { variant: "success" });
        } else if (response.status === 204) {
          this.props.enqueueSnackbar("Write command failed", { variant: "error" });
        } else if (response.status === 403) {
          this.props.enqueueSnackbar("Write access denied", { variant: "error" });
        } else {
          throw Error("Unexpected response code: " + response.status);
        }
      })
      .catch((error) => {
        this.props.enqueueSnackbar(
          error.message || "Problem writing value", { variant: "error" }
        );
      });

    if (devicevalue) {
      this.setState({
        devicevalue: undefined
      });
    }

  };

  sendCommand = (i: any) => {
    this.setState({
      devicevalue: {
        id: this.state.selectedDevice!,
        data: this.state.deviceData?.data[i]!,
        uom: this.state.deviceData?.data[i + 1]!,
        name: this.state.deviceData?.data[i + 2]!,
        cmd: this.state.deviceData?.data[i + 3]!,
      }
    });
  }

  noDevices = () => {
    return this.props.data.devices.length === 0;
  };

  noSensors = () => {
    return this.props.data.sensors.length === 0;
  };

  noDeviceData = () => {
    return (this.state.deviceData?.data || []).length === 0;
  };

  renderDeviceItems() {
    const { width, data } = this.props;
    return (
      <TableContainer>
        <Typography variant="h6" color="primary">
          EMS Devices
        </Typography>
        <p></p>
        {!this.noDevices() && (
          <Table
            size="small"
            padding={isWidthDown("xs", width!) ? "none" : "default"}
          >
            <TableBody>
              {data.devices.sort(compareDevices).map((device) => (
                <TableRow hover key={device.id} onClick={() => this.handleRowClick(device)}>
                  <TableCell>
                    <CustomTooltip
                      title={"DeviceID:0x" + ("00" + device.deviceid.toString(16).toUpperCase()).slice(-2) + " ProductID:" + device.productid + " Version:" + device.version}
                      placement="right-end"
                    >
                      <Button startIcon={<ListIcon />} size="small" variant="outlined">
                        {device.type}
                      </Button>
                    </CustomTooltip>
                  </TableCell>
                  <TableCell>{device.brand + " " + device.name} </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {this.noDevices() && (
          <Box
            bgcolor="error.main"
            color="error.contrastText"
            p={2} mt={2} mb={2}
          >
            <Typography variant="body1">
              No EMS devices found. Check the connections and for possible Tx errors.
            </Typography>
          </Box>
        )}
      </TableContainer>
    );
  }

  renderSensorItems() {
    const { data } = this.props;
    return (
      <TableContainer>
        <p></p>
        <Typography variant="h6" color="primary" paragraph>
          Dallas Sensors
        </Typography>
        {!this.noSensors() && (
          <Table size="small" padding="default">
            <TableHead>
              <TableRow>
                <StyledTableCell>Sensor #</StyledTableCell>
                <StyledTableCell align="center">ID</StyledTableCell>
                <StyledTableCell align="right">Temperature</StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.sensors.map((sensorData) => (
                <TableRow key={sensorData.no}>
                  <TableCell component="th" scope="row">
                    {sensorData.no}
                  </TableCell>
                  <TableCell align="center">{sensorData.id}</TableCell>
                  <TableCell align="right">
                    {formatTemp(sensorData.temp)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {this.noSensors() && (
          <Box color="warning.main" p={0} mt={0} mb={0}>
            <Typography variant="body1">
              <i>no external temperature sensors were detected</i>
            </Typography>
          </Box>
        )}
      </TableContainer>
    );
  }

  renderScanDevicesDialog() {
    return (
      <Dialog
        open={this.state.confirmScanDevices}
        onClose={this.onScanDevicesRejected}
      >
        <DialogTitle>Confirm Scan Devices</DialogTitle>
        <DialogContent dividers>
          Are you sure you want to initiate a scan on the EMS bus for all new devices?
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={this.onScanDevicesRejected} color="secondary">
            Cancel
          </Button>
          <Button
            startIcon={<RefreshIcon />} variant="contained" onClick={this.onScanDevicesConfirmed} disabled={this.state.processing} color="primary" autoFocus>
            Start Scan
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  onScanDevices = () => {
    this.setState({ confirmScanDevices: true });
  };

  onScanDevicesRejected = () => {
    this.setState({ confirmScanDevices: false });
  };

  onScanDevicesConfirmed = () => {
    this.setState({ processing: true });
    redirectingAuthorizedFetch(SCANDEVICES_ENDPOINT)
      .then((response) => {
        if (response.status === 200) {
          this.props.enqueueSnackbar("Device scan is starting...", {
            variant: "info",
          });
          this.setState({ processing: false, confirmScanDevices: false });
        } else {
          throw Error("Invalid status code: " + response.status);
        }
      })
      .catch((error) => {
        this.props.enqueueSnackbar(error.message || "Problem with scan", {
          variant: "error",
        });
        this.setState({ processing: false, confirmScanDevices: false });
      });
  };

  handleRowClick = (device: any) => {
    this.setState({ selectedDevice: device.id, deviceData: undefined });
    redirectingAuthorizedFetch(DEVICE_DATA_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({ id: device.id }),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        if (response.status === 200) {
          return response.json();
        }
        throw Error("Unexpected response code: " + response.status);
      })
      .then((json) => {
        this.setState({ deviceData: json });
      })
      .catch((error) => {
        this.props.enqueueSnackbar(
          error.message || "Problem getting device data",
          { variant: "error" }
        );
        this.setState({ deviceData: undefined });
      });
  };

  renderDeviceData() {
    const { deviceData } = this.state;
    const { width } = this.props;
    const me = this.props.authenticatedContext.me;

    if (this.noDevices()) {
      return;
    }

    if (!deviceData) {
      return;
    }

    return (
      <Fragment>
        <p></p>
        <Box bgcolor="info.main" p={1} mt={1} mb={1}>
          <Typography variant="body1" color="initial">
            {deviceData.name}
          </Typography>
        </Box>
        {!this.noDeviceData() && (
          <TableContainer>
            <Table
              size="small"
              padding={isWidthDown("xs", width!) ? "none" : "default"}
            >
              <TableHead>
              </TableHead>
              <TableBody>
                {deviceData.data.map((item, i) => {
                  if (i % 4) {
                    return null;
                  } else {
                    return (
                      <TableRow hover key={i}>
                        <TableCell padding="checkbox" style={{ width: 18 }} >
                          {deviceData.data[i + 3] && me.admin && (
                            <CustomTooltip title="change value" placement="left-end"
                            >
                              <IconButton edge="start" size="small" aria-label="Edit"
                                onClick={() => this.sendCommand(i)}>
                                <EditIcon color="primary" fontSize="small" />
                              </IconButton>
                            </CustomTooltip>
                          )}
                        </TableCell>
                        <TableCell padding="none" component="th" scope="row">{deviceData.data[i + 2]}</TableCell>
                        <TableCell padding="none" align="right">{deviceData.data[i]}{formatUnit(deviceData.data[i + 1])}</TableCell>
                      </TableRow>
                    );
                  }
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {this.noDeviceData() && (
          <Box color="warning.main" p={0} mt={0} mb={0}>
            <Typography variant="body1">
              <i>No data available for this device</i>
            </Typography>
          </Box>
        )}
      </Fragment >
    );
  }

  render() {
    const { devicevalue } = this.state;
    return (
      <Fragment>
        <br></br>
        {this.renderDeviceItems()}
        {this.renderDeviceData()}
        {this.renderSensorItems()}
        <br></br>
        <Box display="flex" flexWrap="wrap">
          <Box flexGrow={1} padding={1}>
            <FormButton startIcon={<RefreshIcon />} variant="contained" color="secondary" onClick={this.props.loadData}            >
              Refresh
            </FormButton>
          </Box>
          <Box flexWrap="none" padding={1} whiteSpace="nowrap">
            <FormButton startIcon={<RefreshIcon />} variant="contained" onClick={this.onScanDevices}            >
              Scan Devices
            </FormButton>
          </Box>
        </Box>
        {this.renderScanDevicesDialog()}
        {
          devicevalue &&
          <ValueForm
            devicevalue={devicevalue}
            onDoneEditing={this.doneEditingValue}
            onCancelEditing={this.cancelEditingValue}
            handleValueChange={this.handleValueChange}
          />
        }
      </Fragment>
    );
  }
}

export default withAuthenticatedContext(withWidth()(EMSESPDevicesForm));
