import {
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLString,
  GraphQLBoolean,
  GraphQLNonNull,
} from 'graphql';

export const DataSourceEnum = new GraphQLEnumType({
  name: 'DataSource',
  values: {
    ESI: { value: 'ESI' },
    SDE: { value: 'SDE' },
    DERIVED: { value: 'DERIVED' },
    CACHE: { value: 'CACHE' },
  },
});

export const DataProvenanceType = new GraphQLObjectType({
  name: 'DataProvenance',
  fields: {
    source: { type: new GraphQLNonNull(DataSourceEnum) },
    capability: { type: new GraphQLNonNull(GraphQLString) },
    version: { type: new GraphQLNonNull(GraphQLString) },
    retrievedAt: { type: GraphQLString },
    calculatedAt: { type: GraphQLString },
    cached: { type: new GraphQLNonNull(GraphQLBoolean) },
  },
});
