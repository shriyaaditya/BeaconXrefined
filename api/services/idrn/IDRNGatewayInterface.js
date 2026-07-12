/**
 * IDRNGatewayInterface
 * 
 * Defines the contract for fetching master resource catalog data from the Government IDRN.
 * This interface allows swapping the simulated adapter with a real production adapter 
 * once the live API is accessible and authorized.
 */

class IDRNGatewayError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'IDRNGatewayError';
    this.statusCode = statusCode;
  }
}

/**
 * Interface contract (JSDoc representation for JavaScript)
 * 
 * @interface IDRNGatewayInterface
 */
class IDRNGatewayInterface {
  /**
   * Fetches the master resource catalog from the IDRN network.
   * Note: This method should return structural catalog data (Centers, Resources, Metadata) 
   * and deliberately omit operational data (e.g. real-time available quantities) to enforce separation of concerns.
   * 
   * @returns {Promise<Array>} Array of center objects with nested static resource definitions.
   * @throws {IDRNGatewayError} If the fetch fails.
   */
  async fetchMasterCatalog() {
    throw new Error('Method not implemented.');
  }
}

module.exports = {
  IDRNGatewayInterface,
  IDRNGatewayError
};
