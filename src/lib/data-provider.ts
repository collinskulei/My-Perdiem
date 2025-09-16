/**
 * @file This file acts as a dynamic data provider for the application.
 * It determines whether to use live Firestore data or mock data from localStorage
 * based on the "Test Mode" setting. This allows for seamless switching
 * between a live and a sandboxed testing environment.
 */

import { isTestMode } from './test-mode';
import * as firestore from './firebase/firestore';
import * as mock from './mock-data';

/**
 * An interface that defines the contract for all data operations.
 * Both the Firestore and mock data providers must implement this interface.
 */
interface DataProvider {
  getVenues: typeof firestore.getVenues;
  addVenue: typeof firestore.addVenue;
  getEmployees: typeof firestore.getEmployees;
  getEmployeeById: typeof firestore.getEmployeeById;
  addEmployee: typeof firestore.addEmployee;
  updateEmployee: typeof firestore.updateEmployee;
  getEvents: typeof firestore.getEvents;
  getEventsByEmployee: typeof firestore.getEventsByEmployee;
  addEvent: typeof firestore.addEvent;
  checkInToEvent: typeof firestore.checkInToEvent;
  getPerDiemRequests: typeof firestore.getPerDiemRequests;
  getPerDiemRequestsByEmployee: typeof firestore.getPerDiemRequestsByEmployee;
  addPerDiemRequest: typeof firestore.addPerDiemRequest;
}

const liveDataProvider: DataProvider = firestore;
const testDataProvider: DataProvider = mock;

/**
 * A singleton object that exposes the correct data handling functions
 * based on the current application mode (live or test).
 *
 * All application components should use this `dataProvider` for any data
 * interactions, rather than calling the firestore or mock functions directly.
 */
export const dataProvider: DataProvider = isTestMode() ? testDataProvider : liveDataProvider;
