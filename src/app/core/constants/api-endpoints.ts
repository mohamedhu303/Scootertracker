import { environment } from '../../../environments/environment';

const BASE_URL = environment.apiBaseUrl;

export const API_ENDPOINTS = {
  auth: {
    login: `${BASE_URL}/api/Auth/login`,
    profile: `${BASE_URL}/api/Auth/profile`,
    changePassword: `${BASE_URL}/api/Auth/change-password`,
    createAdmin: `${BASE_URL}/api/Auth/create-admin`,
  },
  users: {
    list: `${BASE_URL}/api/User`,
    byId: (id: string) => `${BASE_URL}/api/User/${id}`,
    suspend: (id: string) => `${BASE_URL}/api/User/${id}/suspend`,
    activate: (id: string) => `${BASE_URL}/api/User/${id}/activate`,
  },
  scooters: {
    list: `${BASE_URL}/api/Scooter`,
    byId: (id: string) => `${BASE_URL}/api/Scooter/${id}`,
    liveMap: `${BASE_URL}/api/Scooter/live-map`,
    status: (serial: string) => `${BASE_URL}/api/Scooter/${serial}/status`,
    unlock: (id: string) => `${BASE_URL}/api/Scooter/${id}/unlock`,
    lock: (id: string) => `${BASE_URL}/api/Scooter/${id}/lock`,
    start: (id: string) => `${BASE_URL}/api/Scooter/${id}/start`,
    stop: (id: string) => `${BASE_URL}/api/Scooter/${id}/stop`,
    ping: (id: string) => `${BASE_URL}/api/Scooter/${id}/ping`,
    maintenance: (id: string) => `${BASE_URL}/api/Scooter/${id}/maintenance`,
    retire: (id: string) => `${BASE_URL}/api/Scooter/${id}/retire`,
  },
  tariffs: {
    list: `${BASE_URL}/api/Tariff`,
    active: `${BASE_URL}/api/Tariff/active`,
    activate: (id: string) => `${BASE_URL}/api/Tariff/${id}/activate`,
    delete: (id: string) => `${BASE_URL}/api/Tariff/${id}`,
  },
  zones: {
    list: `${BASE_URL}/api/Zone`,
    byId: (id: string) => `${BASE_URL}/api/Zone/${id}`,
    byLocation: `${BASE_URL}/api/Zone/location`,
  },
  wallet: {
    adjust: `${BASE_URL}/api/Wallet/adjust`,
    transactions: `${BASE_URL}/api/Wallet/transactions`,
  },
  ride: {
    pendingPhotos: `${BASE_URL}/api/Ride/parking-photos/pending`,
    reviewPhoto: (rideId: string) => `${BASE_URL}/api/Ride/parking-photos/${rideId}/review`,
  }
};