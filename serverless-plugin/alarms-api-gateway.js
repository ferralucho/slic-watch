'use strict'

const { makeResourceName, getStatisticName } = require('./util')

/**
 * @param {object} apiGwAlarmConfig The fully resolved alarm configuration
 */
module.exports = function ApiGatewayAlarms (apiGwAlarmConfig, context) {
  return {
    createApiGatewayAlarms
  }

  /**
   * Add all required API Gateway alarms to the provided CloudFormation template
   * based on the resources found within
   *
   * @param {CloudFormationTemplate} cfTemplate A CloudFormation template object
   */
  function createApiGatewayAlarms (cfTemplate) {
    const apiResources = cfTemplate.getResourcesByType(
      'AWS::ApiGateway::RestApi'
    )

    for (const [apiResourceName, apiResource] of Object.entries(apiResources)) {
      const alarms = []

      if (apiGwAlarmConfig['5XXError'].enabled) {
        alarms.push(createAvailabilityAlarm(
          apiResourceName,
          apiResource,
          apiGwAlarmConfig['5XXError']
        ))
      }

      if (apiGwAlarmConfig['4XXError'].enabled) {
        alarms.push(create4XXAlarm(
          apiResourceName,
          apiResource,
          apiGwAlarmConfig['4XXError']
        ))
      }

      if (apiGwAlarmConfig.Latency.enabled) {
        alarms.push(createLatencyAlarm(
          apiResourceName,
          apiResource,
          apiGwAlarmConfig.Latency
        ))
      }

      for (const alarm of alarms) {
        cfTemplate.addResource(alarm.resourceName, alarm.resource)
      }
    }
  }

  function createApiAlarm (
    alarmName,
    alarmDescription,
    apiName,
    comparisonOperator,
    threshold,
    metricName,
    statistic,
    period,
    extendedStatistic,
    evaluationPeriods,
    treatMissingData
  ) {
    const metricProperties = {
      Dimensions: [{ Name: 'ApiName', Value: apiName }],
      MetricName: metricName,
      Namespace: 'AWS/ApiGateway',
      Period: period,
      Statistic: statistic,
      ExtendedStatistic: extendedStatistic
    }

    return {
      Type: 'AWS::CloudWatch::Alarm',
      Properties: {
        ActionsEnabled: true,
        AlarmActions: context.alarmActions,
        AlarmName: alarmName,
        AlarmDescription: alarmDescription,
        EvaluationPeriods: evaluationPeriods,
        ComparisonOperator: comparisonOperator,
        Threshold: threshold,
        TreatMissingData: treatMissingData,
        ...metricProperties
      }
    }
  }

  function createAvailabilityAlarm (apiResourceName, apiResource, config) {
    const apiName = apiResource.Properties.Name // TODO: Allow for Ref usage in resource names (see #14)
    const threshold = config.Threshold
    return {
      resourceName: makeResourceName('Api', apiName, 'Availability'),
      resource: createApiAlarm(
        `ApiAvailability_${apiName}`,
        `API 5XXError ${getStatisticName(config)} for ${apiName} breaches ${threshold}`,
        apiName,
        config.ComparisonOperator,
        threshold,
        '5XXError',
        config.Statistic,
        config.Period,
        config.ExtendedStatistic,
        config.EvaluationPeriods,
        config.TreatMissingData
      )
    }
  }

  function create4XXAlarm (apiResourceName, apiResource, config) {
    const apiName = apiResource.Properties.Name // TODO: Allow for Ref usage in resource names (see #14)
    const threshold = config.Threshold
    return {
      resourceName: makeResourceName('Api', apiName, '4XXError'),
      resource: createApiAlarm(
        `Api4XXError_${apiName}`,
        `API 4XXError ${getStatisticName(config)} for ${apiName} breaches ${threshold}`,
        apiName,
        config.ComparisonOperator,
        threshold,
        '4XXError',
        config.Statistic,
        config.Period,
        config.ExtendedStatistic,
        config.EvaluationPeriods,
        config.TreatMissingData
      )
    }
  }

  function createLatencyAlarm (apiResourceName, apiResource, config) {
    const apiName = apiResource.Properties.Name // TODO: Allow for Ref usage in resource names (see #14)
    const threshold = config.Threshold
    return {
      resourceName: makeResourceName('Api', apiName, 'Latency'),
      resource: createApiAlarm(
        `ApiLatency_${apiName}`,
        `API Latency ${getStatisticName(config)} for ${apiName} breaches ${threshold}`,
        apiName,
        config.ComparisonOperator,
        threshold,
        'Latency',
        config.Statistic,
        config.Period,
        config.ExtendedStatistic,
        config.EvaluationPeriods,
        config.TreatMissingData
      )
    }
  }
}
