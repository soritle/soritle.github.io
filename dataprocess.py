import networkx as nx
import json
import re
import pandas as pd
from networkx.readwrite import json_graph
from collections import Counter

# load the original data
G=nx.read_graphml('data/marvel-graph.graphml')
data = json_graph.node_link_data(G)

# load predefined movie data
movie = pd.read_csv('data/movie_total.csv', index_col=0)

# load predefined hero data
hero = pd.read_csv('data/hero_total.csv', index_col=0)

edge = []
counts = Counter()
for link in data['links']:
    edge.append({'movie': int(movie.loc[link['target'],'movie']), 'hero': hero.loc[link['source'],'hero']})
    counts[link['source']] = counts.get(link['source'],0) + 1

# update movie counts
for key in counts:
    hero.loc[key, 'num_movies'] = counts[key]

hero.to_csv('data/hero_total.csv')

# generate edges between heroes and movies
with open('data/hero_per_movie.json', 'w') as f:
    json.dump(edge, f, indent=4)

movies = []
for i in range(len(movie)):
     movies.append({'movie': int(movie['movie'][i]), 'phase': int(movie['phase'][i]), 'title': movie['name'][i]})

# generate movie nodes
with open('data/movie_total.json', 'w') as f:
  json.dump(movies, f, indent=4)
