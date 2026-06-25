import type { JwtServiceDTO, UpdateJwtServiceInput } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Alert, AlertDescription } from "@rezics/ui/shadcn";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { Page } from "@/admin/core/layouts/Page";
import {
  activateAuthJwtService,
  deactivateAuthJwtService,
  rotateAuthJwtService,
  updateAuthJwtService,
  useAuthJwtServiceListQuery,
} from "../hooks/useAuthJwtServiceAdmin";
import {
  JwtServiceEditDialog,
  JwtServiceTable,
} from "../../jwt-service/components";

export const AuthJwtServicesPage: FC = () => {
  const { t } = useTranslation(["admin"]);
  const listQuery = useAuthJwtServiceListQuery();
  const { data, isLoading, error } = listQuery;

  const [services, setServices] = useState<JwtServiceDTO[]>([]);

  useEffect(() => {
    if (data?.services) setServices(data.services);
  }, [data]);

  const [updating, setUpdating] = useState(false);
  const [updatingServiceKey, setUpdatingServiceKey] = useState<string | null>(
    null,
  );
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
      const updated = await updateAuthJwtService(serviceKey, input);
      setServices((current) =>
        current.map((service) =>
          service.serviceKey === serviceKey ? updated : service,
        ),
      );
      await listQuery.refetch();
      setOpenEdit(false);
      setEditingService(null);
    } catch (err) {
      setUpdatingError((err as Error)?.message ?? t("admin:jwt_update_failed"));
    } finally {
      setUpdating(false);
    }
  };

  const handleActivate = async (serviceKey: string) => {
    setUpdatingError(null);
    try {
      setUpdating(true);
      setUpdatingServiceKey(serviceKey);
      const updated = await activateAuthJwtService(serviceKey);
      setServices((current) =>
        current.map((service) =>
          service.serviceKey === serviceKey ? updated : service,
        ),
      );
      setEditingService(updated);
      await listQuery.refetch();
    } catch (err) {
      setUpdatingError(
        (err as Error)?.message ?? t("admin:jwt_activate_failed"),
      );
    } finally {
      setUpdating(false);
      setUpdatingServiceKey(null);
    }
  };

  const handleDeactivate = async (serviceKey: string) => {
    setUpdatingError(null);
    try {
      setUpdating(true);
      setUpdatingServiceKey(serviceKey);
      const updated = await deactivateAuthJwtService(serviceKey);
      setServices((current) =>
        current.map((service) =>
          service.serviceKey === serviceKey ? updated : service,
        ),
      );
      setEditingService(updated);
      await listQuery.refetch();
    } catch (err) {
      setUpdatingError(
        (err as Error)?.message ?? t("admin:jwt_deactivate_failed"),
      );
    } finally {
      setUpdating(false);
      setUpdatingServiceKey(null);
    }
  };

  const handleRotate = async (serviceKey: string) => {
    setUpdatingError(null);
    try {
      setUpdating(true);
      setUpdatingServiceKey(serviceKey);
      const updated = await rotateAuthJwtService(serviceKey);
      setServices((current) =>
        current.map((service) =>
          service.serviceKey === serviceKey ? updated : service,
        ),
      );
      setEditingService((current) =>
        current?.serviceKey === serviceKey ? updated : current,
      );
      await listQuery.refetch();
    } catch (err) {
      setUpdatingError((err as Error)?.message ?? "Failed to rotate key");
    } finally {
      setUpdating(false);
      setUpdatingServiceKey(null);
    }
  };

  return (
    <Page title={t("admin:jwt_auth_title")}>
      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <Spinner />
        </div>
      )}

      {error && (
        <Alert className="mb-4">
          <AlertDescription className="text-error-text">
            {(error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && services.length === 0 && (
        <div className="flex items-center justify-center h-40">
          <p className="text-base text-text-secondary">
            {t("admin:jwt_auth_empty")}
          </p>
        </div>
      )}

      {!isLoading && !error && services.length > 0 && (
        <JwtServiceTable
          services={services}
          onEdit={handleEdit}
          onActivate={handleActivate}
          onDeactivate={handleDeactivate}
          onRotate={handleRotate}
          updatingServiceKey={updatingServiceKey}
        />
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
    </Page>
  );
};

export default AuthJwtServicesPage;
