import { parse } from 'graphql'

// Parse a request to convert the request into an AST, and then use that AST
// and the other information to produce a cache key.
export const prepareRequest = request => {
  const { query, ... req } = request.rawRequest;
  const parsed = parse(query);
  stripLocations(parsed);

  const key = JSON.stringify({
    rawRequest: { query: parsed, ... req },
    session: request.session
  });

  return { parsed, key };
}

// The AST parsed by the `graphql` package contains location information from
// the original file. We strip all this as we want our caching to be
// independent of whitespace.
export const stripLocations = abstractSyntaxTree => {
  switch (typeof abstractSyntaxTree) {
    case 'object':
      delete abstractSyntaxTree.loc

      for (const key in abstractSyntaxTree) {
        stripLocations(abstractSyntaxTree[key])
      }
  }
}
