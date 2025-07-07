import React from 'react';
import '../Pagination.css'; // Импорт стилей для Pagination

const Pagination = ({ itemsPerPage, totalItems, paginate, currentPage }) => {
  const pageNumbers = [];
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const maxPagesToShow = 5;

  const getPageRange = () => {
    let startPage, endPage;
    if (totalPages <= maxPagesToShow) {
      startPage = 1;
      endPage = totalPages;
    } else {
      const maxPagesBeforeCurrentPage = Math.floor(maxPagesToShow / 2);
      const maxPagesAfterCurrentPage = Math.ceil(maxPagesToShow / 2) - 1;
      if (currentPage <= maxPagesBeforeCurrentPage) {
        startPage = 1;
        endPage = maxPagesToShow;
      } else if (currentPage + maxPagesAfterCurrentPage >= totalPages) {
        startPage = totalPages - maxPagesToShow + 1;
        endPage = totalPages;
      } else {
        startPage = currentPage - maxPagesBeforeCurrentPage;
        endPage = currentPage + maxPagesAfterCurrentPage;
      }
    }
    return { startPage, endPage };
  };

  const { startPage, endPage } = getPageRange();

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  // Не отображаем пагинацию, если страниц меньше двух
  if (pageNumbers.length < 2) {
    return null;
  }

  return (
    <nav className="pagination-nav">
      <ul className="pagination-list">
        {currentPage > 1 && (
          <li className="pagination-item">
            <button
              onClick={() => paginate(currentPage - 1)}
              className="pagination-button"
            >
              Предыдущая
            </button>
          </li>
        )}

        {startPage > 1 && (
          <>
            <li className="pagination-item">
              <button
                onClick={() => paginate(1)}
                className="pagination-button"
              >
                1
              </button>
            </li>
            {startPage > 2 && <li className="pagination-ellipsis">...</li>}
          </>
        )}

        {pageNumbers.map(number => (
          <li key={number} className="pagination-item">
            <button
              onClick={() => paginate(number)}
              className={`pagination-button ${currentPage === number ? 'active' : ''}`}
            >
              {number}
            </button>
          </li>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <li className="pagination-ellipsis">...</li>}
            <li className="pagination-item">
              <button
                onClick={() => paginate(totalPages)}
                className="pagination-button"
              >
                {totalPages}
              </button>
            </li>
          </>
        )}

        {currentPage < totalPages && (
          <li className="pagination-item">
            <button
              onClick={() => paginate(currentPage + 1)}
              className="pagination-button"
            >
              Следующая
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
};

export default Pagination;