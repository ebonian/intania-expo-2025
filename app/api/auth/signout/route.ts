import { deleteJwtToken } from "@/lib/backend/cookie";
import { onlyAuthorized } from "@/lib/backend/middleware";
import { prisma, returnPrismaError } from "@/lib/backend/prisma";
import { HTTPError } from "@/lib/backend/types/httpError";
import { StatusCodes } from "http-status-codes";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
): Promise<NextResponse<object | HTTPError>> {
  const cookieStore = await cookies();

  const middlewareRes = onlyAuthorized(cookieStore);
  if (!middlewareRes.pass) {
    return middlewareRes.response!;
  }

  const { accessToken, tokenId } = middlewareRes.data!;

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json(
      { error: "invalid request body. expect tokenId" },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  try {
    await prisma.token.delete({
      where: { id: tokenId, accessToken: accessToken },
    });
  } catch (error) {
    return returnPrismaError(error, [
      {
        code: "P2025",
        msg: "token not found",
        status: StatusCodes.NOT_FOUND,
      },
    ]);
  }

  deleteJwtToken(cookieStore);

  return NextResponse.json({}, { status: StatusCodes.OK });
}
