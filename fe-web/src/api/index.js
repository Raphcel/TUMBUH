/**
 * Barrel export — import everything from one place:
 *   import { authApi, companiesApi, ... } from "@/api";
 */
export { default as api, setToken, getToken } from './client';
export { default as authApi } from './auth';
export { default as companiesApi } from './companies';
export { default as companyFollowsApi } from './companyFollows';
export { default as opportunitiesApi } from './opportunities';
export { default as organizationsApi } from './organizations';
export { default as applicationsApi } from './applications';
export { default as bookmarksApi } from './bookmarks';
export { default as externshipsApi } from './externships';
export { default as usersApi } from './users';
export { default as logbooksApi } from './logbooks';
