import type {
  CreateJwtServiceInput,
  JwtServiceDTO,
  UpdateJwtServiceInput,
} from "@rezics/contract";
import { defaultJwtCryptoProvider } from "@rezics/jwt";
import { type Prisma, prisma } from "#prisma/client";
import { getAuthJwksGracePeriodSeconds } from "../session/jwt/options";

function mapToDTO(record: {
  id: string;
  serviceKey: string;
  issuer: string;
  audience: string;
  jwksUrl: string;
  jwksPath: string;
  isLocalIssuer: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): JwtServiceDTO {
  return {
    id: record.id,
    serviceKey: record.serviceKey,
    issuer: record.issuer,
    audience: record.audience,
    jwksUrl: record.jwksUrl,
    jwksPath: record.jwksPath,
    isLocalIssuer: record.isLocalIssuer,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export const authJwtServiceAdminService = {
  async list(): Promise<JwtServiceDTO[]> {
    const records = await prisma.jwtService.findMany({
      orderBy: { createdAt: "asc" },
    });
    return records.map(mapToDTO);
  },

  async fetch(serviceKey: string): Promise<JwtServiceDTO | null> {
    const record = await prisma.jwtService.findUnique({
      where: { serviceKey },
    });
    return record ? mapToDTO(record) : null;
  },

  async create(input: CreateJwtServiceInput): Promise<JwtServiceDTO> {
    const record = await prisma.jwtService.create({
      data: {
        serviceKey: input.serviceKey,
        issuer: input.issuer,
        audience: input.audience,
        jwksUrl: input.jwksUrl,
        jwksPath: input.jwksPath,
        isLocalIssuer: input.isLocalIssuer ?? false,
        isActive: true,
      },
    });
    return mapToDTO(record);
  },

  async update(
    serviceKey: string,
    input: UpdateJwtServiceInput,
  ): Promise<JwtServiceDTO> {
    const record = await prisma.jwtService.update({
      where: { serviceKey },
      data: {
        ...(input.issuer !== undefined ? { issuer: input.issuer } : {}),
        ...(input.audience !== undefined ? { audience: input.audience } : {}),
        ...(input.jwksUrl !== undefined ? { jwksUrl: input.jwksUrl } : {}),
        ...(input.jwksPath !== undefined ? { jwksPath: input.jwksPath } : {}),
        ...(input.isLocalIssuer !== undefined
          ? { isLocalIssuer: input.isLocalIssuer }
          : {}),
      },
    });
    return mapToDTO(record);
  },

  async activate(serviceKey: string): Promise<JwtServiceDTO> {
    const record = await prisma.jwtService.update({
      where: { serviceKey },
      data: { isActive: true },
    });
    return mapToDTO(record);
  },

  async deactivate(serviceKey: string): Promise<JwtServiceDTO> {
    const record = await prisma.jwtService.update({
      where: { serviceKey },
      data: { isActive: false },
    });
    return mapToDTO(record);
  },

  async rotate(serviceKey: string): Promise<JwtServiceDTO> {
    const service = await prisma.jwtService.findUnique({
      where: { serviceKey },
    });
    if (!service) {
      throw new Error(`JwtService not found: ${serviceKey}`);
    }
    if (!service.isLocalIssuer) {
      throw new Error(`JwtService is not a local issuer: ${serviceKey}`);
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + getAuthJwksGracePeriodSeconds() * 1000,
    );
    const keyPair = await defaultJwtCryptoProvider.generateKey();
    const kid = `jwt-${now.toISOString()}`;

    await prisma.$transaction([
      prisma.jwks.updateMany({
        where: {
          jwtServiceId: service.id,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: { expiresAt },
      }),
      prisma.jwks.create({
        data: {
          id: kid,
          jwtServiceId: service.id,
          publicJwk: {
            ...keyPair.publicJwk,
            kid,
          } as unknown as Prisma.InputJsonValue,
          privateJwk: {
            ...keyPair.privateJwk,
            kid,
          } as unknown as Prisma.InputJsonValue,
          alg: "ES256",
        },
      }),
    ]);

    return mapToDTO(service);
  },
};
