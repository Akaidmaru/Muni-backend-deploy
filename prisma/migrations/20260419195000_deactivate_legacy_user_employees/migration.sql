UPDATE "Employee" e
SET "active" = false
WHERE e."id" IN (
  SELECT u."id"
  FROM "User" u
  WHERE u."role" = 'EMPLOYEE'
)
AND NOT EXISTS (
  SELECT 1
  FROM "TripHistory" th
  WHERE th."employeeId" = e."id"
);
