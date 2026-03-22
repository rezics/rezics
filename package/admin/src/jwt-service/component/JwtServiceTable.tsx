import type {FC} from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import type {JwtServiceDTO} from '@package/contract';

type Props = {
  services: JwtServiceDTO[];
  onEdit: (service: JwtServiceDTO) => void;
};

export const JwtServiceTable: FC<Props> = ({services, onEdit}) => {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Service Key</TableCell>
            <TableCell>Issuer</TableCell>
            <TableCell>Audience</TableCell>
            <TableCell>Local Issuer</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {services.map(service => (
            <TableRow key={service.serviceKey} hover>
              <TableCell>
                <strong>{service.serviceKey}</strong>
              </TableCell>
              <TableCell sx={{maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis'}}>
                {service.issuer}
              </TableCell>
              <TableCell>{service.audience}</TableCell>
              <TableCell>
                {service.isLocalIssuer ? (
                  <Chip label="Local" size="small" color="info" />
                ) : (
                  <Chip label="Remote" size="small" variant="outlined" />
                )}
              </TableCell>
              <TableCell>
                {service.isActive ? (
                  <Chip label="Active" size="small" color="success" />
                ) : (
                  <Chip label="Inactive" size="small" color="default" />
                )}
              </TableCell>
              <TableCell align="right">
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => onEdit(service)}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
