import { auth, clerkClient } from "@clerk/nextjs/server";

export interface CurrentOrgInfo {
  orgId: string;
  name: string;
  slug: string | null;
  needsActiveSet: boolean;
}

/**
 * Reads or provisions the current organization on the server.
 *
 * Guaranteed to return an organization for signed-in users on first paint:
 * 1. Reads orgId from the active Clerk token if set.
 * 2. If missing, checks user's existing organization memberships.
 * 3. If user has no memberships, auto-creates a default organization.
 */
export async function getOrProvisionCurrentOrg(): Promise<CurrentOrgInfo | null> {
  const { userId, orgId } = await auth();

  if (!userId) {
    return null;
  }

  const client = await clerkClient();

  if (orgId) {
    try {
      const org = await client.organizations.getOrganization({ organizationId: orgId });
      return {
        orgId: org.id,
        name: org.name,
        slug: org.slug,
        needsActiveSet: false,
      };
    } catch {
      // Fallback if org resolution fails
    }
  }

  // Check user's organization memberships
  try {
    const memberships = await client.users.getOrganizationMembershipList({ userId });
    if (memberships.data && memberships.data.length > 0) {
      const targetOrg = memberships.data[0].organization;
      return {
        orgId: targetOrg.id,
        name: targetOrg.name,
        slug: targetOrg.slug,
        needsActiveSet: true,
      };
    }
  } catch {
    // Continue to creation fallback if membership lookup fails
  }

  // Auto-provision an organization for brand new user
  const user = await client.users.getUser(userId);
  const displayName =
    user.firstName ||
    user.username ||
    user.emailAddresses[0]?.emailAddress?.split("@")[0] ||
    "Personal";
  const orgName = `${displayName}'s Workspace`;

  const createdOrg = await client.organizations.createOrganization({
    name: orgName,
    createdBy: userId,
  });

  return {
    orgId: createdOrg.id,
    name: createdOrg.name,
    slug: createdOrg.slug,
    needsActiveSet: true,
  };
}
