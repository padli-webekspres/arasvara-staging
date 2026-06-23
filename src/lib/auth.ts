import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, UserProfile } from "@/types/user";
import { getCollection } from "./db/db";
import { ObjectId } from "mongodb";
import type { Secret, SignOptions } from "jsonwebtoken";
import {
  ACCESS_TOKEN_COOKIE,
  JWT_ACCESS_EXPIRES_IN,
  LEGACY_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth-config";
import { setAuthCookies } from "@/lib/auth-cookies";
import {
  createRefreshToken,
  validateAndRotateRefreshToken,
} from "@/services/refreshTokenService";

function getJwtSecret(): Secret {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET wajib di-set di production");
  }
  return "dev-only-jwt-secret-change-me";
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string) {
  return bcrypt.compare(password, hashedPassword);
}

export function generateAccessToken(user: UserProfile) {
  return jwt.sign(
    {
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || undefined,
      role: user.role,
      ...(user.teamId && { teamId: user.teamId }),
      ...(user.team && { team: user.team }),
    },
    getJwtSecret(),
    {
      expiresIn: JWT_ACCESS_EXPIRES_IN,
    } as SignOptions,
  );
}

/** @deprecated Gunakan generateAccessToken */
export const generateToken = generateAccessToken;

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}

export function getAccessTokenFromRequest(request: NextRequest): string | null {
  return (
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ??
    request.cookies.get(LEGACY_TOKEN_COOKIE)?.value ??
    null
  );
}

export function getRefreshTokenFromRequest(
  request: NextRequest,
): string | null {
  return request.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
}

export async function getAccessTokenFromCookieStore(): Promise<string | null> {
  const cookieStore = await cookies();
  return (
    cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ??
    cookieStore.get(LEGACY_TOKEN_COOKIE)?.value ??
    null
  );
}

export async function issueAuthSession(user: UserProfile): Promise<void> {
  const accessToken = generateAccessToken(user);
  const { raw: refreshRaw } = await createRefreshToken(user._id);
  const cookieStore = await cookies();
  setAuthCookies(cookieStore, accessToken, refreshRaw);
}

export async function refreshAuthSession(
  refreshRaw: string,
): Promise<{ user: UserProfile; accessToken: string; refreshRaw: string } | null> {
  const rotated = await validateAndRotateRefreshToken(refreshRaw);
  if (!rotated) return null;

  const users = await getCollection("users");
  const user = await users.findOne(
    { _id: new ObjectId(rotated.userId) },
    {
      projection: {
        _id: 1,
        name: 1,
        email: 1,
        role: 1,
        avatar: 1,
        isActive: 1,
        teamId: 1,
        team: 1,
      },
    },
  );

  if (!user || user.isActive === false) return null;

  const userProfile: UserProfile = {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    teamId: user.teamId,
    team: user.team,
  };

  const accessToken = generateAccessToken(userProfile);
  return {
    user: userProfile,
    accessToken,
    refreshRaw: rotated.newRefreshRaw,
  };
}

export async function authenticateUser(email: string, password: string) {
  const users = await getCollection("users");
  const user = await users.findOne(
    { email },
    {
      projection: {
        password: 1,
        isActive: 1,
        _id: 1,
        name: 1,
        email: 1,
        role: 1,
        avatar: 1,
        teamId: 1,
        team: 1,
      },
    },
  );

  if (!user) {
    throw new Error("Invalid credentials");
  }

  if (!user.isActive) {
    throw new Error("Account is deactivated");
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  const userProfile: User = {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    isActive: user.isActive,
  };

  const token = generateAccessToken(userProfile);
  return { user: userProfile, token };
}

export async function getUserFromToken(
  token: string,
): Promise<UserProfile | null> {
  const decoded = verifyToken(token);
  if (!decoded || typeof decoded !== "object" || !("_id" in decoded))
    return null;

  const users = await getCollection("users");
  const userId =
    typeof decoded._id === "string" && ObjectId.isValid(decoded._id)
      ? new ObjectId(decoded._id)
      : decoded._id;

  const user = await users.findOne(
    { _id: userId },
    {
      projection: {
        _id: 1,
        name: 1,
        email: 1,
        role: 1,
        avatar: 1,
        isActive: 1,
        teamId: 1,
        team: 1,
      },
    },
  );

  if (!user || !user.isActive) return null;

  const userProfile: UserProfile = {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    teamId: user.teamId,
    team: user.team,
  };

  return userProfile;
}

export async function getUserFromRequest(
  request: NextRequest,
): Promise<UserProfile | null> {
  const token = getAccessTokenFromRequest(request);
  if (!token) return null;
  return getUserFromToken(token);
}
