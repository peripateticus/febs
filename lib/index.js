module.exports = {
  /**
   * Determines if error returned from webpack contains *only* syntax/parse errors.
   * If this returns false, we assume lint-only errors.
   *
   * TODO: Is there a more reliable way to determine this as we rely on the
   * actual text of any error messages generated by the various transpilers that
   * we use.
   *
   * @param stats The webpack stats object passed to the callback after running.
   * @returns {boolean} Whether or not the build contains any syntax/parse errors.
   */
  isSyntaxParseOnlyErrors(stats) {
    if (stats.compilation.errors && stats.compilation.errors.length > 0) {
      return [
        'syntax error', // ES
        'parsing error', // ES
        'unexpected token', // Riot
        'error compiling template', // Vue
        'syntaxerror', // Vue
        'module build failed', // Less/SCSS
      ].some(errorString => stats.compilation.errors.some(error => (
        error.message.toLowerCase().includes(errorString.toLowerCase())
      )));
    }
    return false;
  },
};
