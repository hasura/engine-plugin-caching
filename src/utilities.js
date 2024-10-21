import * as graphql from "graphql";

export const parse = graphql.parse

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

export const stripLocations = abstractSyntaxTree => {
  switch (typeof abstractSyntaxTree) {
    case 'object':
      delete abstractSyntaxTree.loc

      for (const key in abstractSyntaxTree) {
        stripLocations(abstractSyntaxTree[key])
      }
  }
}
