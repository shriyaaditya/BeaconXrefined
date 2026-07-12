const idrnGateway = require('../services/idrnGateway');

/**
 * Controller handling retrieval of IDRN center resources.
 * This triggers the synchronization of master catalog data via the configured IDRN adapter.
 */
async function getIdrnResources(req, res) {
  console.log('IDRN controller: Querying IDRN gateway integration...');
  try {
    const data = await idrnGateway.syncCatalog();
    return res.status(200).json({
      status: 'success',
      source: 'idrn_gateway',
      timestamp: new Date().toISOString(),
      data
    });
  } catch (error) {
    console.error('IDRN controller gateway sync failure:', error);
    return res.status(503).json({
      status: 'error',
      error: 'IDRNGatewaySyncFailure',
      message: 'IDRN gateway synchronization failed. Please check server logs.'
    });
  }
}

module.exports = {
  getIdrnResources
};
