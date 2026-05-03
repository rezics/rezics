import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import {
  useActivateJwtServiceMutation,
  useDeactivateJwtServiceMutation,
  useUpdateJwtServiceMutation,
} from "@rezics/api/jwt-service/jwt-service.mutations";
import { jwtServiceQueries } from "@rezics/api/jwt-service/jwt-service.queries";
import type { JwtServiceDTO, UpdateJwtServiceInput } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { JwtServiceEditDialog, JwtServiceTable } from "../components";

export const JwtServicesPage: FC = () => {
  const { data, isLoading, error } = useQuery(jwtServiceQueries.list());

  const [services, setServices] = useState<JwtServiceDTO[]>([]);

  useEffect(() => {
    if (data?.services) setServices(data.services);
  }, [data]);

  const updateMutation = useUpdateJwtServiceMutation();
  const activateMutation = useActivateJwtServiceMutation();
  const deactivateMutation = useDeactivateJwtServiceMutation();

  const [updating, setUpdating] = useState(false);
  const [editingService, setEditingService] = useState<JwtServiceDTO | null>(
    null,
  );
  const [openEdit, setOpenEdit] = useState(false);
  const [updatingError, setUpdatingError] = useState<string | null>(null);

  const handleEdit = (service: JwtServiceDTO) => {
    setEditingService(service);
    setUpdatingError(null);
    setOpenEdit(true);
  };

  const handleUpdate = async (
    serviceKey: string,
    input: UpdateJwtServiceInput,
  ) => {
    setUpdatingError(null);
    try {
      setUpdating(true);
      await updateMutation.mutateAsync({ serviceKey, input });
      setOpenEdit(false);
      setEditingService(null);
    } catch (err) {
      setUpdatingError((err as Error)?.message ?? "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  const handleActivate = async (serviceKey: string) => {
    setUpdatingError(null);
    try {
      setUpdating(true);
      const updated = await activateMutation.mutateAsync(serviceKey);
      setEditingService(updated);
    } catch (err) {
      setUpdatingError((err as Error)?.message ?? "Activate failed");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeactivate = async (serviceKey: string) => {
    setUpdatingError(null);
    try {
      setUpdating(true);
      const updated = await deactivateMutation.mutateAsync(serviceKey);
      setEditingService(updated);
    } catch (err) {
      setUpdatingError((err as Error)?.message ?? "Deactivate failed");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Box className="w-11/12 mx-auto mt-16">
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h3" className="font-bold mb-8">
          JWT Services
        </Typography>
      </Stack>

      {isLoading && (
        <Box className="flex items-center justify-center h-40">
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" className="mb-4">
          {(error as Error).message}
        </Alert>
      )}

      {!isLoading && !error && services.length === 0 && (
        <Box className="flex items-center justify-center h-40">
          <Typography variant="h6" color="textSecondary">
            No JWT services found
          </Typography>
        </Box>
      )}

      {!isLoading && !error && services.length > 0 && (
        <JwtServiceTable services={services} onEdit={handleEdit} />
      )}

      <JwtServiceEditDialog
        open={openEdit}
        service={editingService}
        onClose={() => {
          setOpenEdit(false);
          setEditingService(null);
        }}
        onUpdate={handleUpdate}
        onActivate={handleActivate}
        onDeactivate={handleDeactivate}
        updating={updating}
        error={updatingError}
      />
    </Box>
  );
};

export default JwtServicesPage;
