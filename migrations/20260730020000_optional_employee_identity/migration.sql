DROP INDEX IF EXISTS "User_employeeId_key";
CREATE UNIQUE INDEX "User_employeeId_nonempty_key" ON "User"("employeeId") WHERE "employeeId" <> '';
