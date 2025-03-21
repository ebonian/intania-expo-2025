import { isOneOfRole, onlyAuthorized } from "@/lib/backend/middleware";
import { prisma, returnPrismaError } from "@/lib/backend/prisma";
import { CreateVisitorSchema } from "@/lib/backend/schemas/visitor";
import { HTTPError } from "@/lib/backend/types/httpError";
import { Visitor } from "@/lib/backend/types/user";
import { StatusCodes } from "http-status-codes";
import { NextResponse } from "next/server";
import { fromZodError } from "zod-validation-error";

export async function POST(
  request: Request,
): Promise<NextResponse<Visitor | HTTPError>> {
  const middlewareResponse = onlyAuthorized(request);
  if (!middlewareResponse.pass) {
    return middlewareResponse.response!;
  }
  const { payload } = middlewareResponse.data!;

  const middlewareResponse2 = isOneOfRole(["VISITOR"], payload);
  if (!middlewareResponse2.pass) {
    return middlewareResponse2.response!;
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: "invalid request body" },
      { status: StatusCodes.BAD_REQUEST },
    );
  }
  const parseResponse = CreateVisitorSchema.safeParse(body);
  if (!parseResponse.success) {
    return NextResponse.json(
      { error: fromZodError(parseResponse.error).toString() },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  const dto = parseResponse.data;
  if (dto.email != payload.email) {
    return NextResponse.json(
      { error: "invalid email for this token" },
      { status: StatusCodes.BAD_REQUEST },
    );
  }

  let visitor;
  try {
    visitor = await prisma.user.create({
      data: { ...dto, role: "VISITOR" },
    });

    const formatNumber = ("000000" + visitor.incrementCode).slice(-6);
    visitor.sixDigitCode = "S-" + formatNumber;

    await prisma.user.update({
      where: { id: visitor.id },
      data: { sixDigitCode: visitor.sixDigitCode },
    });
  } catch (error) {
    return returnPrismaError(error, [
      {
        code: "P2002",
        msg: "email already exists",
        status: StatusCodes.BAD_REQUEST,
      },
    ]);
  }

  return NextResponse.json(visitor as Visitor, { status: StatusCodes.CREATED });
}
