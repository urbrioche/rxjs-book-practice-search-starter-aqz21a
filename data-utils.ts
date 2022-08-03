import { ajax } from 'rxjs/ajax';
import { map } from 'rxjs/operators';

// Search Repositories API Document 
// https://docs.github.com/en/free-pro-team@latest/rest/reference/search#search-repositories

const baseUrl = `https://api.github.com/search/repositories`

const toSuggestionList = (repositories) => {
  return repositories.map(repository => repository.full_name)
};

export const getSuggestions = (keyword: string) => {
  const searchUrl = `${baseUrl}?q=${keyword}&per_page=10&page=1`;
  return ajax(searchUrl).pipe(
    map(response => response.response.items),
    map(toSuggestionList)
  );
};

const toSearchResult = (repositories) => {
  return repositories.map(repository => ({
    name: repository.full_name,
    forks: repository.forks_count,
    stars: repository.stargazers_count
  }))
};

export const getSearchResult = (
  keyword: string, 
  sort: string = 'stars',
  order = 'desc', 
  page = 1, 
  perPage = 10) => {
  const searchUrl = `${baseUrl}?q=${keyword}&sort=${sort}&order=${order}&page=${page}&per_page=${perPage}`;

  return ajax(searchUrl).pipe(
    map(response => response.response.items),
    map(toSearchResult)
  );
};