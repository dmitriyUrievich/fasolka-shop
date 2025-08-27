// src/components/Pagination.js
import React, { useMemo } from 'react';
import '../Pagination.css';

const Pagination = ({ itemsPerPage, totalItems, paginate, currentPage }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // 🔹 Мемоизация диапазона страниц
  const pageNumbers = useMemo(() => {
    const maxPagesToShow = 5;
    let startPage, endPage;

    if (totalPages <= maxPagesToShow) {
      startPage = 1;
      endPage = totalPages;
    } else {
      const half = Math.floor(maxPagesToShow / 2);
      if (currentPage <= half) {
        startPage = 1;
        endPage = maxPagesToShow;
      } else if (currentPage + half >= totalPages) {
        startPage = totalPages - maxPagesToShow + 1;
        endPage = totalPages;
      } else {
        startPage = currentPage - half;
        endPage = currentPage + half;
      }
    }

    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }, [totalPages, currentPage]);

  if (totalPages < 2) return null;

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

        {pageNumbers[0] > 1 && (
          <>
            <li className="pagination-item">
              <button onClick={() => paginate(1)} className="pagination-button">1</button>
            </li>
            {pageNumbers[0] > 2 && <li className="pagination-ellipsis">...</li>}
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

        {pageNumbers[pageNumbers.length - 1] < totalPages && (
          <>
            {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <li className="pagination-ellipsis">...</li>}
            <li className="pagination-item">
              <button onClick={() => paginate(totalPages)} className="pagination-button">{totalPages}</button>
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

export default React.memo(Pagination);